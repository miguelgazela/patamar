"use client";

import { useState } from "react";
import { classeBotao, classeCampo, Mensagens, useAccaoComValores } from "../fracoes/formularios";
import type { EstadoForm } from "../fracoes/actions";
import { guardarDefinicoesAction } from "./actions";

export interface Definicoes {
  nome: string;
  morada: string;
  nif: string | null;
  iban: string | null;
  modo: "fixa" | "permilagem";
  valor: string;
  fundo: string;
  dia: number;
}

export function FormDefinicoes({
  d,
  accaoServidor = guardarDefinicoesAction,
  rotulo = "Guardar definições",
  antes,
  depois,
}: {
  d: Definicoes;
  accaoServidor?: (e: EstadoForm, f: FormData) => Promise<EstadoForm>;
  rotulo?: string;
  /** Campos extra no início do formulário (onboarding). */
  antes?: (valores?: Record<string, string>) => React.ReactNode;
  depois?: (valores?: Record<string, string>) => React.ReactNode;
}) {
  const [estado, accao, aCorrer] = useAccaoComValores(accaoServidor);
  const v = estado.valores;
  const [modo, setModo] = useState<string>(v?.modo ?? d.modo);

  return (
    <form action={accao} className="flex flex-col gap-4">
      {antes?.(v)}
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-muted">Condomínio</legend>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nome
          <input name="nome" required defaultValue={v?.nome ?? d.nome} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Morada
          <input name="morada" required defaultValue={v?.morada ?? d.morada} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          NIF do condomínio
          <input name="nif" inputMode="numeric" defaultValue={v?.nif ?? d.nif ?? ""} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          IBAN da conta do condomínio
          <input name="iban" defaultValue={v?.iban ?? d.iban ?? ""} placeholder="PT50 0000 0000 0000 0000 0000 0" className={classeCampo} />
          <span className="text-xs font-normal text-muted">Mostrado aos condóminos na secção «Como pagar». A app nunca recebe nem guarda dinheiro.</span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-muted">Quotas</legend>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Como se calcula a quota
          <select name="modo" defaultValue={v?.modo ?? d.modo} onChange={(e) => setModo(e.target.value)} className={classeCampo}>
            <option value="fixa">Valor igual para todas as frações</option>
            <option value="permilagem">Repartida pela permilagem</option>
          </select>
          <span className="text-xs font-normal text-muted">
            {modo === "fixa"
              ? "Por regra, a lei reparte as despesas pela permilagem; dividir em partes iguais tem requisitos próprios (ex.: acordo em assembleia). Confirme o que foi decidido no seu prédio."
              : "A quota de cada fração é proporcional à sua permilagem. A soma das permilagens deve ser 1000 ‰."}
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {modo === "fixa" ? "Quota mensal por fração (€)" : "Total mensal do prédio (€)"}
          <input name="valor" inputMode="decimal" required defaultValue={v?.valor ?? d.valor} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Fundo comum de reserva (% da quota)
          <input name="fundo" inputMode="decimal" required defaultValue={v?.fundo ?? d.fundo} className={classeCampo} />
          <span className="text-xs font-normal text-muted">A lei exige um fundo comum de reserva; o mínimo legal é 10 % das contribuições.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Dia de vencimento (1 a 28)
          <input name="dia" type="number" min={1} max={28} required defaultValue={v?.dia ?? d.dia} className={classeCampo} />
        </label>
        <p className="text-xs text-muted">As alterações aplicam-se às quotas geradas a partir de agora; as já geradas não mudam.</p>
      </fieldset>

      {depois?.(v)}
      <Mensagens estado={estado} />
      <button disabled={aCorrer} className={classeBotao}>{aCorrer ? "A guardar…" : rotulo}</button>
    </form>
  );
}
