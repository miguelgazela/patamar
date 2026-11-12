import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { diasEntre, formatarData, hojeEmLisboa } from "@/lib/datas";
import { calcularLembretes, montarLembrete } from "@/lib/lembretes";
import { carregarContexto } from "@/lib/lembretes-envio";
import { formatarEuros } from "@/lib/money";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ConfigLembretes, ListaLembretes, type CandidatoVista } from "./formularios";

export const metadata = { title: "Lembretes · Patamar" };

export default function Lembretes() {
  return (
    <Suspense fallback={<main role="status" className="mx-auto w-full max-w-md px-4 py-12 text-muted">A carregar…</main>}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  await connection();
  const hoje = hojeEmLisboa();
  const papel = await papelDoUtilizador(hoje);
  if (papel.tipo !== "administrador") redirect("/");

  const supabase = await criarClienteServidor();
  const [ctx, historico] = await Promise.all([
    carregarContexto(supabase, papel.condominioId, hoje),
    supabase.from("lembretes").select("id, data, email, divida_cent, modo, estado, fracoes(identificacao)").eq("condominio_id", papel.condominioId).order("enviado_em", { ascending: false }).limit(15),
  ]);
  if (!ctx) redirect("/");

  const candidatos: CandidatoVista[] = calcularLembretes(ctx.fracoes, ctx.config, hoje).map((c) => ({
    fracaoId: c.fracaoId,
    identificacao: c.identificacao,
    destinatarios: c.destinatarios.map((d) => d.nome),
    semEmail: c.semEmail,
    quotas: c.quotas.length,
    totalCent: c.totalCent,
    dias: c.diasDesdePrimeiroIncumprimento,
    diasParaPrazo: diasEntre(hoje, c.prazoCobranca),
    ultimoLembrete: c.ultimoLembrete,
    elegivel: c.elegivel,
    motivo: c.motivo,
    previsao: `Assunto: Aviso de quotas em atraso · ${ctx.condominio.nome}\n\n${montarLembrete({ condominio: ctx.condominio, administrador: ctx.administrador, destinatarioNome: c.destinatarios[0]?.nome ?? "(proprietário)", candidato: c, hoje }).texto}`,
  }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Lembretes de atraso</h1>
        <p className="text-sm text-muted">Email em nome do condomínio a quem tem quotas em atraso. As respostas chegam ao administrador.</p>
      </header>

      {candidatos.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-5 text-ok-ink">Não há quotas em atraso. Nada para enviar.</p>
      ) : (
        <ListaLembretes candidatos={candidatos} />
      )}

      <details className="rounded-lg border border-line bg-surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand">Envio automático</summary>
        <div className="mt-2">
          <ConfigLembretes automaticos={ctx.condominio.automaticos} tolerancia={ctx.config.toleranciaDias} intervalo={ctx.config.intervaloDias} />
        </div>
      </details>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Enviados recentemente</h2>
        {historico.data && historico.data.length > 0 ? (
          <ul className="divide-y divide-line text-sm">
            {historico.data.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{(h.fracoes as unknown as { identificacao: string } | null)?.identificacao} · {formatarEuros(h.divida_cent)}</p>
                  <p className="text-muted">{formatarData(h.data)} · {h.email} · {h.modo === "automatico" ? "automático" : "manual"}</p>
                </div>
                {h.estado === "falhou" && <span className="rounded-full bg-bad-bg px-2 py-0.5 text-xs text-bad-ink">Falhou</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Ainda não foram enviados lembretes.</p>
        )}
      </section>
    </main>
  );
}
