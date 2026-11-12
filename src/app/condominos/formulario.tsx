"use client";

import { useAccaoComValores } from "../fracoes/formularios";
import { convidarAction } from "./actions";

export function Convidar({ pessoaId, email, acesso }: { pessoaId: string; email: string | null; acesso: "sem_acesso" | "convidado" | "ativo" }) {
  const [estado, accao, aCorrer] = useAccaoComValores(convidarAction);
  const temConta = acesso !== "sem_acesso";
  return (
    <form action={accao} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="pessoaId" value={pessoaId} />
      {!temConta && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input name="email" type="email" required defaultValue={estado.valores?.email ?? email ?? ""} className="w-full rounded-md border border-line bg-surface px-3 py-3 text-base" />
        </label>
      )}
      {estado.erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{estado.erro}</p>}
      {estado.ok && <p role="status" className="rounded-md bg-ok-bg px-3 py-2 text-sm text-ok-ink">{estado.ok}</p>}
      <button disabled={aCorrer} className="min-h-11 rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-60">
        {aCorrer ? "A enviar…" : temConta ? "Reenviar convite" : "Convidar"}
      </button>
    </form>
  );
}
