"use client";

import { useState, useTransition } from "react";
import { formatarData } from "@/lib/datas";
import { formatarEuros } from "@/lib/money";
import { classeBotao, classeCampo, Mensagens, useAccaoComValores } from "../fracoes/formularios";
import { enviarLembretesAction, guardarConfigLembretesAction } from "./actions";

export interface CandidatoVista {
  fracaoId: string;
  identificacao: string;
  destinatarios: string[];
  semEmail: string[];
  quotas: number;
  totalCent: number;
  dias: number;
  diasParaPrazo: number;
  ultimoLembrete: string | null;
  elegivel: boolean;
  motivo: "ok" | "tolerancia" | "intervalo" | "sem_email";
  previsao: string;
}

const MOTIVOS = {
  ok: "",
  tolerancia: "Ainda dentro da tolerância",
  intervalo: "Lembrete enviado há pouco",
  sem_email: "Sem email do proprietário",
} as const;

export function ListaLembretes({ candidatos }: { candidatos: CandidatoVista[] }) {
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set(candidatos.filter((c) => c.elegivel).map((c) => c.fracaoId)));
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aCorrer, iniciar] = useTransition();

  const alternar = (id: string, on: boolean) =>
    setEscolhidos((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  function enviar() {
    setMsg(null);
    iniciar(async () => {
      const r = await enviarLembretesAction([...escolhidos]);
      if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
      const partes = [`${r.enviados} ${r.enviados === 1 ? "lembrete enviado" : "lembretes enviados"}`];
      if (r.falhas > 0) partes.push(`${r.falhas} falharam`);
      if (r.semEmail > 0) partes.push(`${r.semEmail} sem email`);
      if (r.limiteAtingido) partes.push("limite diário de envios atingido");
      setMsg({ tipo: r.falhas > 0 || r.limiteAtingido ? "erro" : "ok", texto: partes.join(" · ") + "." });
      setEscolhidos(new Set());
    });
  }

  const n = [...escolhidos].filter((id) => candidatos.find((c) => c.fracaoId === id)?.destinatarios.length).length;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {candidatos.map((c) => {
          const podeEnviar = c.destinatarios.length > 0;
          return (
            <li key={c.fracaoId} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{c.identificacao} <span className="font-normal text-muted">· {formatarEuros(c.totalCent)}</span></p>
                  <p className="text-sm text-muted">{c.quotas} {c.quotas === 1 ? "quota" : "quotas"} · {c.dias} {c.dias === 1 ? "dia" : "dias"} desde o primeiro incumprimento</p>
                  <p className="text-sm text-muted">{c.destinatarios.length > 0 ? `Para: ${c.destinatarios.join(", ")}` : MOTIVOS.sem_email}{c.semEmail.length > 0 && c.destinatarios.length > 0 ? ` (sem email: ${c.semEmail.join(", ")})` : ""}</p>
                  {c.ultimoLembrete && <p className="text-sm text-muted">Último lembrete: {formatarData(c.ultimoLembrete)}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${c.diasParaPrazo < 0 ? "bg-bad-bg text-bad-ink" : "bg-warn-bg text-warn-ink"}`}>
                  {c.diasParaPrazo < 0 ? `Prazo de 90 dias excedido há ${-c.diasParaPrazo} dias` : `${c.diasParaPrazo} dias para os 90 dias`}
                </span>
              </div>
              {c.motivo !== "ok" && c.motivo !== "sem_email" && <p className="mt-1 text-xs text-muted">{MOTIVOS[c.motivo]}. Pode enviar na mesma.</p>}
              <label className="mt-2 flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5" disabled={!podeEnviar} checked={escolhidos.has(c.fracaoId) && podeEnviar} onChange={(e) => alternar(c.fracaoId, e.target.checked)} />
                Enviar lembrete
              </label>
              <details className="rounded-md border border-line bg-surface-2 p-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand">Ver o email</summary>
                <pre className="whitespace-pre-wrap break-words text-xs">{c.previsao}</pre>
              </details>
            </li>
          );
        })}
      </ul>
      {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${msg.tipo === "erro" ? "bg-bad-bg text-bad-ink" : "bg-ok-bg text-ok-ink"}`}>{msg.texto}</p>}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper px-4 py-3">
        <button disabled={aCorrer || n === 0} onClick={enviar} className={`${classeBotao} w-full`}>
          {aCorrer ? "A enviar…" : n === 0 ? "Nenhum lembrete selecionado" : `Enviar ${n} ${n === 1 ? "lembrete" : "lembretes"}`}
        </button>
      </div>
    </div>
  );
}

export function ConfigLembretes({ automaticos, tolerancia, intervalo }: { automaticos: boolean; tolerancia: number; intervalo: number }) {
  const [estado, accao, aCorrer] = useAccaoComValores(guardarConfigLembretesAction);
  const v = estado.valores;
  return (
    <form action={accao} className="flex flex-col gap-3">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input name="automaticos" type="checkbox" defaultChecked={automaticos} className="size-5" />
        Enviar lembretes automaticamente (uma vez por dia, se o servidor estiver configurado)
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Dias de tolerância após o vencimento
        <input name="tolerancia" type="number" min={0} max={60} required defaultValue={v?.tolerancia ?? tolerancia} className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Dias mínimos entre lembretes à mesma fração
        <input name="intervalo" type="number" min={1} max={90} required defaultValue={v?.intervalo ?? intervalo} className={classeCampo} />
      </label>
      <Mensagens estado={estado} />
      <button disabled={aCorrer} className={classeBotao}>{aCorrer ? "A guardar…" : "Guardar"}</button>
    </form>
  );
}
