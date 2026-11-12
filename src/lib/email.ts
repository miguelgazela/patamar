import "server-only";

export { escaparHtml } from "./html";

export interface Email {
  /** Nome mostrado como remetente (ex.: o condomínio). */
  deNome?: string;
  /** Respostas vão para este endereço (ex.: o administrador). */
  responderPara?: string | null;
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

/**
 * Envia um email transacional. Produção: Resend (RESEND_API_KEY, EMAIL_FROM).
 * Desenvolvimento: API de envio do Mailpit (EMAIL_DEV_URL). Sem nenhum, falha com erro claro.
 */
export async function enviarEmail(e: Email): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: e.deNome ? `${e.deNome.replace(/[<>"]/g, "")} <${(process.env.EMAIL_FROM ?? "").match(/<(.+)>/)?.[1] ?? process.env.EMAIL_FROM}>` : process.env.EMAIL_FROM, to: [e.para], subject: e.assunto, html: e.html, text: e.texto, ...(e.responderPara ? { reply_to: e.responderPara } : {}) }),
    });
    if (!r.ok) throw new Error(`Resend respondeu ${r.status}`);
    return;
  }
  if (process.env.EMAIL_DEV_URL) {
    const r = await fetch(`${process.env.EMAIL_DEV_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ From: { Email: "patamar@example.com", Name: e.deNome ?? "Patamar" }, To: [{ Email: e.para }], ...(e.responderPara ? { ReplyTo: [{ Email: e.responderPara }] } : {}), Subject: e.assunto, Text: e.texto, HTML: e.html }),
    });
    if (!r.ok) throw new Error(`Mailpit respondeu ${r.status}`);
    return;
  }
  throw new Error("Envio de email não configurado (RESEND_API_KEY ou EMAIL_DEV_URL).");
}
