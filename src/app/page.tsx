import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { papelDoUtilizador, resumoDoAdmin } from "@/lib/dados";
import { formatarData, hojeEmLisboa, nomeDoMes } from "@/lib/datas";
import { formatarEuros } from "@/lib/money";
import { sair } from "./entrar/actions";
import { PortalCondomino } from "./portal-condomino";

const CATEGORIAS: Record<string, string> = {
  luz: "Luz", agua: "Água", limpeza: "Limpeza", elevador: "Elevador", seguro: "Seguro",
  manutencao: "Manutenção", administracao: "Administração", outro: "Outro",
};

export const metadata = { title: "Início · Patamar" };

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-1)]">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{titulo}</h2>
      {children}
    </section>
  );
}

export default function Inicio() {
  return (
    <Suspense fallback={<main role="status" className="mx-auto w-full max-w-md px-4 py-12 text-muted">A carregar…</main>}>
      <ConteudoInicio />
    </Suspense>
  );
}

async function ConteudoInicio() {
  await connection(); // dados por pedido: depende da sessão e da data de hoje
  const hoje = hojeEmLisboa();
  const papel = await papelDoUtilizador(hoje);
  if (papel.tipo === "desconhecido") redirect("/bem-vindo");
  if (papel.tipo === "condomino") return <PortalCondomino condominioId={papel.condominioId} />;

  const r = await resumoDoAdmin(papel.condominioId, hoje);
  const pct = r.mesAtual.emitidoCent ? Math.round((r.mesAtual.pagoCent / r.mesAtual.emitidoCent) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand">{r.condominio.nome}</h1>
          <p className="text-sm text-muted">{r.condominio.morada}</p>
        </div>
        <form action={sair}><button className="min-h-11 px-2 text-sm text-brand underline">Sair</button></form>
      </header>

      <nav aria-label="Cobrança" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Cobrança</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/quotas" className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover">Quotas do mês</Link>
          <Link href="/extrato" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-surface px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Importar extrato</Link>
          <Link href="/lembretes" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-surface px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Lembretes de atraso</Link>
        </div>
      </nav>
      <nav aria-label="Contas" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Contas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/despesas/nova" className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover"><span aria-hidden>📷</span> Nova despesa por fotografia</Link>
          <Link href="/documentos" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-surface px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Documentos em PDF</Link>
        </div>
      </nav>
      <nav aria-label="O prédio" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">O prédio</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/fracoes" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-surface px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Frações</Link>
          <Link href="/condominos" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-surface px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Condóminos e convites</Link>
          <Link href="/definicoes" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-surface px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Definições</Link>
          <Link href="/conta" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-surface px-4 py-3 font-semibold text-brand hover:bg-brand-soft">Privacidade e dados</Link>
        </div>
      </nav>

      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo="Saldo do condomínio">
          <p className="font-display text-4xl font-semibold">{formatarEuros(r.contas.saldoCent)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Disponível (corrente)</dt>
            <dd className="text-right font-medium">{formatarEuros(r.contas.saldoCorrenteCent)}</dd>
            <dt className="text-muted">Fundo de reserva</dt>
            <dd className="text-right font-medium">{formatarEuros(r.contas.fundoReservaCent)}</dd>
          </dl>
        </Cartao>

        <Cartao titulo={`Quotas de ${nomeDoMes(r.mes)}`}>
          <p className="font-display text-3xl font-semibold">
            {r.mesAtual.fracoesPagas} de {r.mesAtual.fracoesTotal} <span className="text-base font-normal text-muted">frações pagas</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Quotas do mês recebidas" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {formatarEuros(r.mesAtual.pagoCent)} de {formatarEuros(r.mesAtual.emitidoCent)} recebidos
          </p>
        </Cartao>
      </div>

      <Cartao titulo="Quotas em atraso">
        {r.atrasos.length === 0 ? (
          <p className="text-ok-ink">Sem quotas em atraso.</p>
        ) : (
          <ul className="divide-y divide-line">
            {r.atrasos.map((a) => (
              <li key={a.fracaoId} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{a.identificacao} <span className="font-normal text-muted">· {a.proprietarios.join(", ")}</span></p>
                  <p className="text-sm text-muted">
                    {a.quotasEmAtraso} {a.quotasEmAtraso === 1 ? "quota" : "quotas"} · {a.diasEmAtraso} {a.diasEmAtraso === 1 ? "dia" : "dias"} desde o primeiro incumprimento
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatarEuros(a.emDividaCent)}</p>
                  <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${a.diasParaPrazo < 0 ? "bg-bad-bg text-bad-ink" : "bg-warn-bg text-warn-ink"}`}>
                    {a.diasParaPrazo < 0
                      ? `Prazo de cobrança judicial excedido há ${-a.diasParaPrazo} ${a.diasParaPrazo === -1 ? "dia" : "dias"}`
                      : `${a.diasParaPrazo} ${a.diasParaPrazo === 1 ? "dia" : "dias"} para o prazo de cobrança judicial`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="Últimas despesas">
        {r.despesasRecentes.length === 0 && <p className="text-muted">Ainda não há despesas. Comece por fotografar uma fatura.</p>}
        <ul className="divide-y divide-line">
          {r.despesasRecentes.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div>
                <p className="font-medium">{CATEGORIAS[d.categoria] ?? d.categoria}{d.pagaPeloFundo && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">Fundo de reserva</span>}</p>
                <p className="text-sm text-muted">{formatarData(d.data)}{d.fornecedor ? ` · ${d.fornecedor}` : ""}</p>
              </div>
              <p className="font-medium">{formatarEuros(d.valorCent)}</p>
            </li>
          ))}
        </ul>
      </Cartao>
    </main>
  );
}
