"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { meses } from "@/lib/datas";
import { lerMes } from "@/lib/migracao";
import { formatarEuros } from "@/lib/money";
import { classeCampo } from "../../fracoes/formularios";
import { migrarHistoricoAction, type ResultadoMigracao } from "./actions";

interface FracaoLinha {
  id: string;
  identificacao: string;
  proprietarios: string[];
  quotaMensalCent: number;
}

export function FormularioMigracao({ fracoes, deInicial, ateInicial }: { fracoes: FracaoLinha[]; deInicial: string; ateInicial: string }) {
  const [de, setDe] = useState(deInicial);
  const [ate, setAte] = useState(ateInicial);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<ResultadoMigracao | null>(null);
  const [aCorrer, iniciar] = useTransition();

  const mDe = lerMes(de);
  const mAte = lerMes(ate);
  const nMeses = mDe && mAte && mDe <= mAte ? meses(mDe, mAte).length : 0;
  const totalDe = (f: FracaoLinha) => nMeses * f.quotaMensalCent;
  const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setResultado(null);
    iniciar(async () => setResultado(await migrarHistoricoAction(dados)));
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <fieldset className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-muted">Período</legend>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Primeiro mês
          <input name="de" type="month" required value={de} onChange={(e) => setDe(e.target.value)} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Último mês
          <input name="ate" type="month" required value={ate} onChange={(e) => setAte(e.target.value)} className={classeCampo} />
        </label>
        <p className="text-xs text-muted sm:col-span-2">
          {nMeses > 0 ? `${nMeses} ${nMeses === 1 ? "mês" : "meses"} de quotas por fração.` : "Escolha um período válido."} Usa a quota e o dia de vencimento das Definições.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-muted">Quanto cada fração já pagou neste período</legend>
        <p className="text-xs text-muted">Some o que consta no Excel. Fica um único pagamento «saldo de abertura» por fração, que cobre as quotas mais antigas. Deixe em branco o que não quer registar.</p>
        {fracoes.map((f) => (
          <div key={f.id} className="flex flex-col gap-1 border-t border-line pt-3 first-of-type:border-0 first-of-type:pt-0">
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>{f.identificacao}{f.proprietarios.length > 0 && <span className="font-normal text-muted"> · {f.proprietarios.join(", ")}</span>}</span>
              <input
                name={`valor_${f.id}`}
                inputMode="decimal"
                placeholder="0,00"
                value={valores[f.id] ?? ""}
                onChange={(e) => setValores((s) => ({ ...s, [f.id]: e.target.value }))}
                className={classeCampo}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Total das quotas do período: {formatarEuros(totalDe(f))}</span>
              <button type="button" onClick={() => setValores((s) => ({ ...s, [f.id]: euros(totalDe(f)) }))} className="min-h-11 rounded-md border border-brand px-3 text-brand">Em dia</button>
              <button type="button" onClick={() => setValores((s) => ({ ...s, [f.id]: "" }))} className="min-h-11 px-2 text-brand underline">Limpar</button>
            </div>
          </div>
        ))}
      </fieldset>

      {resultado && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
          {resultado.erroGeral ? (
            <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-bad-ink">{resultado.erroGeral}</p>
          ) : (
            <>
              <p className="font-medium text-ok-ink">
                {resultado.quotasCriadas} quotas criadas · {resultado.pagamentos} {resultado.pagamentos === 1 ? "pagamento registado" : "pagamentos registados"}
                {resultado.duplicados > 0 && ` · ${resultado.duplicados} já existiam`}
              </p>
              {resultado.erros.length > 0 && (
                <ul className="rounded-md bg-bad-bg px-3 py-2 text-bad-ink">
                  {resultado.erros.map((e) => <li key={e.fracao}>{e.fracao}: {e.mensagem}</li>)}
                </ul>
              )}
              <Link href="/quotas" className="min-h-11 w-fit rounded-md bg-brand px-4 py-3 font-semibold text-on-brand">Ver quotas</Link>
            </>
          )}
        </div>
      )}

      <button disabled={aCorrer || nMeses === 0} className="min-h-12 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {aCorrer ? "A importar…" : "Gerar quotas e registar saldos"}
      </button>
    </form>
  );
}
