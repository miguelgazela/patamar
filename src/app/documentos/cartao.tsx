"use client";

import { useState, useTransition } from "react";
import { classeCampo } from "../fracoes/formularios";
import { publicarDocumentoAction } from "./actions";

interface Props {
  titulo: string;
  descricao: string;
  tipo: "relatorio" | "ata" | "declaracao";
  rotuloCampo: string;
  opcoes: { valor: string; rotulo: string }[];
  publicavel: boolean;
}

export function CartaoDocumento({ titulo, descricao, tipo, rotuloCampo, opcoes, publicavel }: Props) {
  const [valor, setValor] = useState(opcoes[0]?.valor ?? "");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aCorrer, iniciar] = useTransition();
  const parametro = tipo === "declaracao" ? "fracao" : "ano";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">{titulo}</h2>
        <p className="text-sm text-muted">{descricao}</p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {rotuloCampo}
        <select value={valor} onChange={(e) => setValor(e.target.value)} className={classeCampo}>
          {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/pdf/${tipo}?${parametro}=${encodeURIComponent(valor)}`}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center rounded-md bg-brand px-4 py-2 font-semibold text-on-brand hover:bg-brand-hover"
        >
          Ver / descarregar PDF
        </a>
        {publicavel && (
          <button
            disabled={aCorrer || !valor}
            onClick={() => {
              setMsg(null);
              iniciar(async () => {
                const r = await publicarDocumentoAction(tipo, Number(valor));
                setMsg(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: r.ok ?? "Publicado." });
              });
            }}
            className="min-h-11 rounded-md border border-brand px-4 py-2 font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"
          >
            {aCorrer ? "A publicar…" : "Publicar no portal"}
          </button>
        )}
      </div>
      {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${msg.tipo === "erro" ? "bg-bad-bg text-bad-ink" : "bg-ok-bg text-ok-ink"}`}>{msg.texto}</p>}
    </section>
  );
}
