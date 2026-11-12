"use client";

import { useAccaoComValores } from "../fracoes/formularios";
import { gerarQuotasAction, registarPagamentoAction } from "./actions";
import { useActionState } from "react";
import type { EstadoAccao } from "./actions";

const campo = "w-full rounded-md border border-line bg-surface px-3 py-3 text-base";

export function GerarQuotas({ mes }: { mes: string }) {
  const [estado, accao, aCorrer] = useActionState<EstadoAccao, FormData>(gerarQuotasAction, {});
  return (
    <form action={accao} className="flex flex-col gap-3">
      <input type="hidden" name="mes" value={mes} />
      {estado.erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{estado.erro}</p>}
      <button disabled={aCorrer} className="min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {aCorrer ? "A gerar…" : "Gerar quotas deste mês"}
      </button>
    </form>
  );
}

export function RegistarPagamento({ fracaoId, sugestaoCent, hoje }: { fracaoId: string; sugestaoCent: number; hoje: string }) {
  const [estado, accao, aCorrer] = useAccaoComValores(registarPagamentoAction);
  const v = estado.valores;
  const sugestao = (sugestaoCent / 100).toFixed(2).replace(".", ",");
  return (
    <details className="mt-3 rounded-md border border-line bg-surface-2 p-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand">Registar pagamento</summary>
      <form action={accao} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="fracaoId" value={fracaoId} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Valor (€)
          <input name="valor" inputMode="decimal" required defaultValue={v?.valor ?? sugestao} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Data do pagamento
          <input name="data" type="date" required defaultValue={v?.data ?? hoje} max={hoje} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Meio
          <select name="meio" defaultValue={v?.meio ?? "transferencia"} className={campo}>
            <option value="transferencia">Transferência</option>
            <option value="numerario">Numerário</option>
            <option value="cheque">Cheque</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Referência (opcional)
          <input name="referencia" defaultValue={v?.referencia ?? ""} className={campo} />
        </label>
        <p className="text-xs text-muted">O valor é distribuído pelas quotas mais antigas por pagar.</p>
        {estado.erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{estado.erro}</p>}
        {estado.ok && <p role="status" className="rounded-md bg-ok-bg px-3 py-2 text-sm text-ok-ink">{estado.ok}</p>}
        <button disabled={aCorrer} className="min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
          {aCorrer ? "A registar…" : "Registar"}
        </button>
      </form>
    </details>
  );
}
