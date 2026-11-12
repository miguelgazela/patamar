"use client";

import { FormDefinicoes } from "../definicoes/formulario";
import { classeCampo } from "../fracoes/formularios";
import { criarCondominioAction } from "./actions";

export function FormularioOnboarding() {
  return (
    <FormDefinicoes
      d={{ nome: "", morada: "", nif: null, iban: null, modo: "fixa", valor: "", fundo: "10", dia: 8 }}
      accaoServidor={criarCondominioAction}
      rotulo="Criar condomínio"
      antes={(v) => (
        <label className="flex flex-col gap-1 text-sm font-medium">
          O seu nome (administrador)
          <input name="nomeAdmin" required defaultValue={v?.nomeAdmin ?? ""} className={classeCampo} />
        </label>
      )}
      depois={(v) => (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-semibold text-muted">Frações</legend>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Uma fração por linha
            <textarea
              name="fracoes"
              required
              rows={6}
              defaultValue={v?.fracoes ?? ""}
              placeholder={"R/C Esq.\n1.º Esq.\n1.º Dto.\n2.º Esq.\n2.º Dto."}
              className={classeCampo}
            />
            <span className="text-xs font-normal text-muted">
              Sem permilagem, dividimos 1000 ‰ em partes iguais. Se a souber, escreva «1.º Esq.; 180» em todas as linhas. Depois pode corrigir, e acrescentar boxes e arrecadações, em «Frações».
            </span>
          </label>
        </fieldset>
      )}
    />
  );
}
