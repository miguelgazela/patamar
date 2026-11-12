"use client";

import { useActionState } from "react";
import { classeCampo, Mensagens } from "../fracoes/formularios";
import type { EstadoForm } from "../fracoes/actions";

export function EliminarConta({ accao, instrucao, rotuloBotao }: { accao: (e: EstadoForm, d: FormData) => Promise<EstadoForm>; instrucao: string; rotuloBotao: string }) {
  const [estado, executar, aCorrer] = useActionState<EstadoForm, FormData>(accao, {});
  return (
    <form action={executar} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {instrucao}
        <input name="confirmacao" required autoComplete="off" className={classeCampo} />
      </label>
      <Mensagens estado={estado} />
      <button disabled={aCorrer} className="min-h-11 rounded-md bg-bad px-4 py-3 font-semibold text-on-brand disabled:opacity-60">
        {aCorrer ? "A eliminar…" : rotuloBotao}
      </button>
    </form>
  );
}
