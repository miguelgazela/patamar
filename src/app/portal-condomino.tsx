import Link from "next/link";
import { formatarData, hojeEmLisboa, nomeDoMes } from "@/lib/datas";
import { portalDoCondomino } from "@/lib/dados-portal";
import { formatarIban } from "@/lib/iban";
import { formatarEuros } from "@/lib/money";
import { sair } from "./entrar/actions";

const CATEGORIAS: Record<string, string> = {
  luz: "Luz", agua: "Água", limpeza: "Limpeza", elevador: "Elevador", seguro: "Seguro",
  manutencao: "Manutenção", administracao: "Administração", outro: "Outro",
};
const MEIOS: Record<string, string> = { transferencia: "Transferência", numerario: "Numerário", cheque: "Cheque", outro: "Outro" };
const ESTADOS = {
  paga: { texto: "Paga", classe: "bg-ok-bg text-ok-ink" },
  parcial: { texto: "Parcial", classe: "bg-warn-bg text-warn-ink" },
  pendente: { texto: "Por pagar", classe: "bg-surface-2 text-muted" },
  anulada: { texto: "Anulada", classe: "bg-surface-2 text-muted" },
} as const;

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-1)]">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{titulo}</h2>
      {children}
    </section>
  );
}

export async function PortalCondomino({ condominioId }: { condominioId: string }) {
  const hoje = hojeEmLisboa();
  const p = await portalDoCondomino(condominioId, hoje);
  const devido = p.fracoes.reduce((a, f) => a + f.emDividaCent, 0);
  const totalCategorias = p.despesasPorCategoria.reduce((a, c) => a + c.totalCent, 0);

  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand">Olá, {p.nome.split(" ")[0]}</h1>
          <p className="text-sm text-muted">{p.condominio.nome}</p>
        </div>
        <div className="flex flex-col items-end">
          <form action={sair}><button className="min-h-11 px-2 text-sm text-brand underline">Sair</button></form>
          <Link href="/conta" className="inline-flex min-h-11 items-center px-2 text-sm text-brand underline">Privacidade e dados</Link>
        </div>
      </header>

      <section className={`rounded-lg p-5 ${devido > 0 ? "bg-bad-bg text-bad-ink" : "bg-ok-bg text-ok-ink"}`}>
        {devido > 0 ? (
          <>
            <p className="text-sm font-medium">Quotas em atraso</p>
            <p className="font-display text-4xl font-semibold">{formatarEuros(devido)}</p>
          </>
        ) : (
          <p className="font-display text-2xl font-semibold">Está tudo em dia. Obrigado!</p>
        )}
      </section>

      {devido > 0 && p.condominio.iban && (
        <Cartao titulo="Como pagar">
          <p className="text-sm text-muted">Transferência bancária para a conta do condomínio:</p>
          <p className="mt-1 break-all font-mono text-lg font-semibold">{formatarIban(p.condominio.iban)}</p>
          <p className="mt-2 text-sm text-muted">Na descrição indique a sua fração (por exemplo, «Quota {p.fracoes[0]?.identificacao}»).</p>
        </Cartao>
      )}

      {p.fracoes.map((f) => (
        <Cartao key={f.id} titulo={`Fração ${f.identificacao}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-muted">Pago em {hoje.slice(0, 4)}: <span className="font-medium text-ink">{formatarEuros(f.pagoNoAnoCent)}</span></p>
            {f.emDividaCent > 0 ? (
              <p className="rounded-full bg-bad-bg px-2.5 py-1 text-xs font-medium text-bad-ink">Em atraso: {formatarEuros(f.emDividaCent)}</p>
            ) : (
              <p className="rounded-full bg-ok-bg px-2.5 py-1 text-xs font-medium text-ok-ink">Em dia</p>
            )}
          </div>
          <details className="mt-3" open={f.emDividaCent > 0}>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand">Quotas</summary>
            <ul className="divide-y divide-line">
              {f.quotas.slice(0, 12).map((q) => {
                const e = ESTADOS[q.estado];
                return (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <p className="font-medium first-letter:uppercase">{nomeDoMes(q.mes)}</p>
                      <p className="text-muted">
                        {formatarEuros(q.valorCent)} · vence a {formatarData(q.dataLimite)}
                        {q.diasEmAtraso > 0 && ` · ${q.diasEmAtraso} ${q.diasEmAtraso === 1 ? "dia" : "dias"} em atraso`}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${e.classe}`}>{e.texto}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        </Cartao>
      ))}

      <Cartao titulo="Os seus últimos pagamentos">
        {p.pagamentos.length === 0 ? (
          <p className="text-muted">Ainda não há pagamentos registados.</p>
        ) : (
          <ul className="divide-y divide-line">
            {p.pagamentos.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-sm">
                <div>
                  <p className="font-medium">{formatarEuros(x.valorCent)}</p>
                  <p className="text-muted">{formatarData(x.data)} · {MEIOS[x.meio] ?? x.meio} · {x.fracao}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {p.contas && (
        <Cartao titulo="Contas do prédio">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Saldo do condomínio</dt>
            <dd className="text-right font-semibold">{formatarEuros(p.contas.saldoCent)}</dd>
            <dt className="text-muted">Fundo comum de reserva</dt>
            <dd className="text-right font-semibold">{formatarEuros(p.contas.fundoReservaCent)}</dd>
          </dl>
          <h3 className="mb-2 mt-4 text-sm font-semibold">Despesas de {hoje.slice(0, 4)} por categoria</h3>
          <ul className="divide-y divide-line">
            {p.despesasPorCategoria.map((c) => (
              <li key={c.categoria} className="flex items-center justify-between py-2 text-sm">
                <span>{CATEGORIAS[c.categoria] ?? c.categoria}</span>
                <span className="font-medium">{formatarEuros(c.totalCent)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between py-2 text-sm font-semibold">
              <span>Total</span>
              <span>{formatarEuros(totalCategorias)}</span>
            </li>
          </ul>
        </Cartao>
      )}

      <Cartao titulo="Documentos">
        {p.documentos.length === 0 ? (
          <p className="text-muted">Ainda não há documentos disponíveis.</p>
        ) : (
          <ul className="divide-y divide-line">
            {p.documentos.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener" className="font-medium text-brand underline">{d.titulo}</a>
                <p className="text-muted">{formatarData(d.data)}</p>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </main>
  );
}
