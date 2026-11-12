import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { quotasDoMes } from "@/lib/dados-quotas";
import { formatarData, hojeEmLisboa, nomeDoMes, primeiroDoMes, somarMeses } from "@/lib/datas";
import { formatarEuros } from "@/lib/money";
import { GerarQuotas, RegistarPagamento } from "./formularios";

export const metadata = { title: "Quotas · Patamar" };

const ESTADOS = {
  paga: { texto: "Paga", classe: "bg-ok-bg text-ok-ink" },
  parcial: { texto: "Parcial", classe: "bg-warn-bg text-warn-ink" },
  pendente: { texto: "Por pagar", classe: "bg-surface-2 text-muted" },
  anulada: { texto: "Anulada", classe: "bg-surface-2 text-muted" },
} as const;

export default function Quotas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<main role="status" className="mx-auto w-full max-w-md px-4 py-12 text-muted">A carregar…</main>}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await connection();
  const hoje = hojeEmLisboa();
  const papel = await papelDoUtilizador(hoje);
  if (papel.tipo !== "administrador") redirect("/");

  const { mes: pedido } = await searchParams;
  const mes = pedido && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(pedido) ? pedido : primeiroDoMes(hoje);
  const d = await quotasDoMes(papel.condominioId, mes, hoje);
  const pagas = d.linhas.filter((l) => l.estado === "paga").length;

  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Quotas</h1>
      </header>

      <Link href="/quotas/migrar" className="flex min-h-11 w-fit items-center text-sm text-brand underline">Gerar vários meses / migrar do Excel</Link>

      <nav className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-2" aria-label="Mês">
        <Link href={`/quotas?mes=${somarMeses(mes, -1)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-brand hover:bg-brand-soft" aria-label="Mês anterior">←</Link>
        <p className="font-display text-lg font-semibold first-letter:uppercase">{nomeDoMes(mes)}</p>
        <Link href={`/quotas?mes=${somarMeses(mes, 1)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-brand hover:bg-brand-soft" aria-label="Mês seguinte">→</Link>
      </nav>

      {!d.geradas ? (
        <section className="rounded-lg border border-line bg-surface p-5">
          <p className="mb-3 text-muted">Ainda não há quotas para {nomeDoMes(mes)}.</p>
          <GerarQuotas mes={mes} />
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-line bg-surface p-5">
            <p className="font-display text-3xl font-semibold">
              {pagas} de {d.linhas.length} <span className="text-base font-normal text-muted">frações pagas</span>
            </p>
            <p className="mt-1 text-sm text-muted">{formatarEuros(d.recebidoCent)} de {formatarEuros(d.emitidoCent)} recebidos neste mês</p>
          </section>

          <ul className="flex flex-col gap-3">
            {d.linhas.map((l) => {
              const e = ESTADOS[l.estado];
              const emFalta = l.valorCent - l.pagoCent;
              return (
                <li key={l.fracaoId} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{l.identificacao}</p>
                      <p className="text-sm text-muted">{l.proprietarios.join(", ") || "Sem proprietário"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${e.classe}`}>{e.texto}</span>
                  </div>
                  {l.quotaId ? (
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">{formatarEuros(l.valorCent)}</span>
                      {l.estado === "parcial" && <span className="text-muted"> · pagos {formatarEuros(l.pagoCent)}</span>}
                      <span className="text-muted"> · vence a {formatarData(l.dataLimite!)}</span>
                      {l.diasEmAtraso > 0 && <span className="ml-2 rounded-full bg-bad-bg px-2 py-0.5 text-xs font-medium text-bad-ink">em atraso há {l.diasEmAtraso} {l.diasEmAtraso === 1 ? "dia" : "dias"}</span>}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Sem quota neste mês.</p>
                  )}
                  {l.dividaTotalCent > 0 && (
                    <p className="mt-1 text-sm text-bad-ink">Dívida total da fração: {formatarEuros(l.dividaTotalCent)}</p>
                  )}
                  {(emFalta > 0 || l.dividaTotalCent > 0) && (
                    <RegistarPagamento fracaoId={l.fracaoId} sugestaoCent={l.dividaTotalCent > 0 ? l.dividaTotalCent : emFalta} hoje={hoje} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
