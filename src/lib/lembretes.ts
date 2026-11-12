import { adicionarDias, diasEntre, formatarData, nomeDoMes, type Data } from "./datas";
import { escaparHtml } from "./html";
import { formatarIban } from "./iban";
import { formatarEuros } from "./money";
import { PRAZO_COBRANCA_DIAS } from "./saldos";

export interface ConfigLembretes {
  /** Dias de atraso da quota mais antiga antes de enviar o primeiro lembrete. */
  toleranciaDias: number;
  /** Dias mínimos entre lembretes à mesma fração. */
  intervaloDias: number;
}

export interface QuotaDevida {
  mes: Data;
  valorCent: number;
  restanteCent: number;
  dataLimite: Data;
}

export interface FracaoParaLembrete {
  id: string;
  identificacao: string;
  proprietarios: { id: string; nome: string; email: string | null }[];
  /** Todas as quotas vencidas e por pagar (restante > 0). */
  quotasVencidas: QuotaDevida[];
  /** Data do último lembrete enviado a esta fração, se houver. */
  ultimoLembrete: Data | null;
}

export interface CandidatoLembrete {
  fracaoId: string;
  identificacao: string;
  destinatarios: { id: string; nome: string; email: string }[];
  semEmail: string[];
  quotas: (QuotaDevida & { diasEmAtraso: number })[];
  totalCent: number;
  primeiroIncumprimento: Data;
  diasDesdePrimeiroIncumprimento: number;
  /** Data até à qual deve avançar a cobrança judicial (90 dias). */
  prazoCobranca: Data;
  ultimoLembrete: Data | null;
  diasDesdeUltimoLembrete: number | null;
  /** Cumpre a tolerância e o intervalo (é o que o envio automático usa). */
  elegivel: boolean;
  motivo: "ok" | "tolerancia" | "intervalo" | "sem_email";
}

/** Todas as frações em atraso, com indicação de quais devem receber lembrete segundo a configuração. */
export function calcularLembretes(fracoes: FracaoParaLembrete[], config: ConfigLembretes, hoje: Data): CandidatoLembrete[] {
  const out: CandidatoLembrete[] = [];
  for (const f of fracoes) {
    if (f.quotasVencidas.length === 0) continue;
    const quotas = [...f.quotasVencidas]
      .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite))
      .map((q) => ({ ...q, diasEmAtraso: diasEntre(q.dataLimite, hoje) }));
    const primeiro = quotas[0].dataLimite;
    const dias = diasEntre(primeiro, hoje);
    const destinatarios = f.proprietarios.filter((p): p is { id: string; nome: string; email: string } => !!p.email);
    const diasUltimo = f.ultimoLembrete ? diasEntre(f.ultimoLembrete, hoje) : null;

    let motivo: CandidatoLembrete["motivo"] = "ok";
    if (destinatarios.length === 0) motivo = "sem_email";
    else if (dias < config.toleranciaDias) motivo = "tolerancia";
    else if (diasUltimo !== null && diasUltimo < config.intervaloDias) motivo = "intervalo";

    out.push({
      fracaoId: f.id,
      identificacao: f.identificacao,
      destinatarios,
      semEmail: f.proprietarios.filter((p) => !p.email).map((p) => p.nome),
      quotas,
      totalCent: quotas.reduce((a, q) => a + q.restanteCent, 0),
      primeiroIncumprimento: primeiro,
      diasDesdePrimeiroIncumprimento: dias,
      prazoCobranca: adicionarDias(primeiro, PRAZO_COBRANCA_DIAS),
      ultimoLembrete: f.ultimoLembrete,
      diasDesdeUltimoLembrete: diasUltimo,
      elegivel: motivo === "ok",
      motivo,
    });
  }
  return out.sort((a, b) => b.diasDesdePrimeiroIncumprimento - a.diasDesdePrimeiroIncumprimento);
}

export interface DadosEmail {
  condominio: { nome: string; morada: string; nif: string | null; iban: string | null };
  administrador: { nome: string; email: string | null };
  destinatarioNome: string;
  candidato: Pick<CandidatoLembrete, "identificacao" | "quotas" | "totalCent" | "diasDesdePrimeiroIncumprimento" | "primeiroIncumprimento">;
  hoje: Data;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Monta o aviso de quotas em atraso, em nome do condomínio. Texto e HTML a partir dos mesmos dados. */
export function montarLembrete(d: DadosEmail): { assunto: string; texto: string; html: string } {
  const { condominio: c, administrador: adm, candidato: k } = d;
  const assunto = `Aviso de quotas em atraso · ${c.nome}`;
  const dias = k.diasDesdePrimeiroIncumprimento;
  const diasTxt = `${dias} ${dias === 1 ? "dia" : "dias"}`;
  const linhas = k.quotas.map((q) => ({
    mes: cap(nomeDoMes(q.mes)),
    venc: formatarData(q.dataLimite),
    valor: formatarEuros(q.restanteCent),
    parcial: q.restanteCent < q.valorCent,
  }));
  const iban = c.iban ? formatarIban(c.iban) : null;

  const texto = [
    `${c.nome}`,
    `${c.morada}${c.nif ? ` · NIF ${c.nif}` : ""}`,
    "",
    `Exmo(a). Sr(a). ${d.destinatarioNome},`,
    "",
    `Verificámos que a fração ${k.identificacao} tem quotas de condomínio por regularizar, em atraso desde ${formatarData(k.primeiroIncumprimento)} (${diasTxt}):`,
    "",
    ...linhas.map((l) => `  - ${l.mes}: ${l.valor} (venceu a ${l.venc})${l.parcial ? ", pagamento parcial já deduzido" : ""}`),
    "",
    `Total em dívida a ${formatarData(d.hoje)}: ${formatarEuros(k.totalCent)}`,
    "",
    iban
      ? `Para regularizar, transfira o valor para a conta do condomínio (IBAN ${iban}), indicando a fração ${k.identificacao} na descrição.`
      : "Para regularizar, contacte a administração do condomínio.",
    "Se já efetuou o pagamento, queira desconsiderar este aviso e informar-nos do mesmo.",
    "",
    "Com os melhores cumprimentos,",
    `${adm.nome}`,
    `Administração do ${c.nome}`,
    adm.email ? `Para esclarecimentos, responda a este email (${adm.email}).` : "",
    "",
    "Este aviso foi enviado em nome do condomínio através da plataforma Patamar. Os seus dados são tratados apenas para a gestão do condomínio.",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  const e = escaparHtml;
  const html = `<div style="font-family:Inter,system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B2433;background:#FAF7F2;padding:24px">
<div style="border-bottom:3px solid #1D4E89;padding-bottom:12px;margin-bottom:20px">
<div style="font-family:Georgia,serif;font-size:20px;color:#1D4E89;font-weight:600">${e(c.nome)}</div>
<div style="font-size:13px;color:#4A5568">${e(c.morada)}${c.nif ? ` · NIF ${e(c.nif)}` : ""}</div></div>
<p>Exmo(a). Sr(a). ${e(d.destinatarioNome)},</p>
<p>Verificámos que a fração <strong>${e(k.identificacao)}</strong> tem quotas de condomínio por regularizar, em atraso desde ${formatarData(k.primeiroIncumprimento)} (${diasTxt}).</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;background:#fff">
<tr style="background:#F3EEE6;text-align:left"><th style="padding:8px">Quota</th><th style="padding:8px">Vencimento</th><th style="padding:8px;text-align:right">Em dívida</th></tr>
${linhas.map((l) => `<tr><td style="padding:8px;border-top:1px solid #E4DDD0">${e(l.mes)}${l.parcial ? " (parcial)" : ""}</td><td style="padding:8px;border-top:1px solid #E4DDD0">${l.venc}</td><td style="padding:8px;border-top:1px solid #E4DDD0;text-align:right">${e(l.valor)}</td></tr>`).join("\n")}
<tr><td colspan="2" style="padding:8px;border-top:2px solid #1D4E89;font-weight:600">Total a ${formatarData(d.hoje)}</td><td style="padding:8px;border-top:2px solid #1D4E89;text-align:right;font-weight:700">${e(formatarEuros(k.totalCent))}</td></tr></table>
${iban ? `<p>Para regularizar, transfira o valor para a conta do condomínio:<br><strong style="font-family:monospace;font-size:16px">${e(iban)}</strong><br><span style="font-size:13px;color:#4A5568">Indique a fração ${e(k.identificacao)} na descrição.</span></p>` : "<p>Para regularizar, contacte a administração do condomínio.</p>"}
<p>Se já efetuou o pagamento, queira desconsiderar este aviso e informar-nos do mesmo.</p>
<p>Com os melhores cumprimentos,<br><strong>${e(adm.nome)}</strong><br>Administração do ${e(c.nome)}${adm.email ? `<br><span style="font-size:13px;color:#4A5568">Para esclarecimentos, responda a este email.</span>` : ""}</p>
<p style="font-size:12px;color:#6B7384;border-top:1px solid #E4DDD0;padding-top:12px">Este aviso foi enviado em nome do condomínio através da plataforma Patamar. Os seus dados são tratados apenas para a gestão do condomínio.</p>
</div>`;
  return { assunto, texto, html };
}
