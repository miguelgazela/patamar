"use client";

import { useActionState, useState } from "react";
import { ROTULOS_TIPO, TIPOS_FRACAO } from "@/lib/fracoes";
import { adicionarAnexoAction, guardarFracaoAction, type EstadoForm } from "./actions";

export const classeCampo = "w-full rounded-md border border-line bg-surface px-3 py-3 text-base";
export const classeBotao = "min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60";

/** Como useActionState, mas em caso de erro devolve os valores submetidos (o React limpa os campos após a ação). */
export function useAccaoComValores(accao: (e: EstadoForm, d: FormData) => Promise<EstadoForm>) {
  return useActionState<EstadoForm, FormData>(async (anterior, dados) => {
    const r = await accao(anterior, dados);
    if (!r.erro) return r;
    return {
      ...r,
      valores: Object.fromEntries([...dados.entries()].map(([k, v]) => [k, String(v)])),
      fracoes: dados.getAll("fracoes").map(String),
    };
  }, {});
}

export function Mensagens({ estado }: { estado: EstadoForm }) {
  return (
    <>
      {estado.erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{estado.erro}</p>}
      {estado.ok && <p role="status" className="rounded-md bg-ok-bg px-3 py-2 text-sm text-ok-ink">{estado.ok}</p>}
    </>
  );
}

export function FormFracao({ fracao }: { fracao?: { id: string; identificacao: string; tipo: string; permilagem: number } }) {
  const [estado, accao, aCorrer] = useAccaoComValores(guardarFracaoAction);
  const v = estado.valores;
  return (
    <form action={accao} className="flex flex-col gap-3">
      {fracao && <input type="hidden" name="id" value={fracao.id} />}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Identificação
        <input name="identificacao" required defaultValue={v?.identificacao ?? fracao?.identificacao} placeholder="1.º Esq." className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tipo
        <select name="tipo" defaultValue={v?.tipo ?? fracao?.tipo ?? "habitacao"} className={classeCampo}>
          {TIPOS_FRACAO.map((t) => <option key={t} value={t}>{ROTULOS_TIPO[t]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Permilagem (‰)
        <input name="permilagem" inputMode="decimal" required defaultValue={v?.permilagem ?? (fracao ? String(fracao.permilagem).replace(".", ",") : "")} placeholder="200" className={classeCampo} />
      </label>
      <Mensagens estado={estado} />
      <button disabled={aCorrer} className={classeBotao}>{aCorrer ? "A guardar…" : fracao ? "Guardar fração" : "Criar fração"}</button>
    </form>
  );
}

export function NovoAnexo({ fracaoId }: { fracaoId: string }) {
  const [estado, accao, aCorrer] = useAccaoComValores(adicionarAnexoAction);
  return (
    <form action={accao} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="fracaoId" value={fracaoId} />
      <div className="flex gap-2">
        <select name="tipo" defaultValue={estado.valores?.tipo ?? "box"} aria-label="Tipo de anexo" className={`${classeCampo} flex-1`}>
          <option value="box">Box</option>
          <option value="arrecadacao">Arrecadação</option>
        </select>
        <input name="identificacao" required defaultValue={estado.valores?.identificacao ?? ""} placeholder="Box 4" aria-label="Identificação do anexo" className={`${classeCampo} flex-1`} />
      </div>
      <Mensagens estado={estado} />
      <button disabled={aCorrer} className="min-h-11 rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-60">
        {aCorrer ? "A adicionar…" : "Adicionar anexo"}
      </button>
    </form>
  );
}

/** Remoção em dois passos: primeiro «Remover», depois «Confirmar». */
export function Remover({ id, accao, rotulo = "Remover", aviso }: { id: string; accao: (e: EstadoForm, d: FormData) => Promise<EstadoForm>; rotulo?: string; aviso?: string }) {
  const [estado, executar, aCorrer] = useActionState<EstadoForm, FormData>(accao, {});
  const [aConfirmar, setAConfirmar] = useState(false);
  return (
    <form action={executar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {aConfirmar ? (
        <div className="flex flex-col gap-2">
          {aviso && <p className="text-sm text-muted">{aviso}</p>}
          <div className="flex gap-2">
            <button disabled={aCorrer} className="min-h-11 flex-1 rounded-md bg-bad px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60">{aCorrer ? "A remover…" : "Confirmar remoção"}</button>
            <button type="button" onClick={() => setAConfirmar(false)} className="min-h-11 flex-1 rounded-md border border-line px-4 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAConfirmar(true)} className="min-h-11 self-start text-sm text-bad-ink underline">{rotulo}</button>
      )}
      <Mensagens estado={estado} />
    </form>
  );
}
