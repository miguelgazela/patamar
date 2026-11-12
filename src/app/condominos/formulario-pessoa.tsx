"use client";

import { classeBotao, classeCampo, Mensagens, useAccaoComValores } from "../fracoes/formularios";
import { guardarPessoaAction } from "./actions-pessoas";

interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  telemovel: string | null;
  nif: string | null;
  fracaoIds: string[];
  acesso: "sem_acesso" | "convidado" | "ativo";
}

export function FormPessoa({ fracoes, pessoa }: { fracoes: { id: string; identificacao: string }[]; pessoa?: Pessoa }) {
  const [estado, accao, aCorrer] = useAccaoComValores(guardarPessoaAction);
  const v = estado.valores;
  const emailBloqueado = !!pessoa && pessoa.acesso !== "sem_acesso";
  return (
    <form action={accao} className="flex flex-col gap-3">
      {pessoa && <input type="hidden" name="id" value={pessoa.id} />}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nome
        <input name="nome" required defaultValue={v?.nome ?? pessoa?.nome} className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" defaultValue={v?.email ?? pessoa?.email ?? ""} readOnly={emailBloqueado} className={`${classeCampo} ${emailBloqueado ? "opacity-70" : ""}`} />
        {emailBloqueado && <span className="text-xs font-normal text-muted">É o email de acesso e não se altera aqui.</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Telemóvel (opcional)
        <input name="telemovel" inputMode="tel" defaultValue={v?.telemovel ?? pessoa?.telemovel ?? ""} className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        NIF (opcional)
        <input name="nif" inputMode="numeric" defaultValue={v?.nif ?? pessoa?.nif ?? ""} className={classeCampo} />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Proprietário de</legend>
        {fracoes.length === 0 && <p className="text-sm text-muted">Crie primeiro as frações.</p>}
        {fracoes.map((f) => (
          <label key={f.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="fracoes" value={f.id} defaultChecked={(estado.fracoes ?? pessoa?.fracaoIds)?.includes(f.id)} className="size-5" />
            {f.identificacao}
          </label>
        ))}
      </fieldset>
      <Mensagens estado={estado} />
      <button disabled={aCorrer} className={classeBotao}>{aCorrer ? "A guardar…" : pessoa ? "Guardar" : "Criar pessoa"}</button>
    </form>
  );
}
