"use client";

import { useActionState, useRef, useState } from "react";
import { guardarDespesaAction, lerFaturaAction, type EstadoGuardar, type EstadoLeitura } from "./actions";
import { CATEGORIAS, type PropostaDespesa } from "@/lib/fatura/tipos";

const ROTULOS: Record<string, string> = {
  luz: "Luz", agua: "Água", limpeza: "Limpeza", elevador: "Elevador", seguro: "Seguro",
  manutencao: "Manutenção", administracao: "Administração", outro: "Outro",
};

const MAX_LADO = 1600;

/** Reduz a fotografia do telemóvel (vários MB) para JPEG até 1600 px: mais rápido e mais barato de ler. */
async function reduzir(ficheiro: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(ficheiro, { imageOrientation: "from-image" });
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], "fatura.jpg", { type: "image/jpeg" }) : ficheiro;
  } catch {
    return ficheiro;
  }
}

const centParaTexto = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

const classeCampo = "w-full rounded-md border border-line bg-surface px-3 py-3 text-base";
const classeBotao = "min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60";

export function Formulario() {
  const [leitura, ler, aLer] = useActionState<EstadoLeitura, FormData>(lerFaturaAction, { passo: "foto" });
  const [manual, setManual] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [preparar, setPreparar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    setPreparar(true);
    const pequeno = await reduzir(original);
    const dt = new DataTransfer();
    dt.items.add(pequeno);
    if (entrada.current) entrada.current.files = dt.files;
    setPrevia(URL.createObjectURL(pequeno));
    setPreparar(false);
  }

  if (leitura.passo === "confirmar" || manual) {
    return (
      <Confirmar
        key={leitura.faturaPath ?? "manual"}
        faturaPath={leitura.faturaPath}
        proposta={leitura.proposta}
        aviso={leitura.aviso}
        previa={previa}
      />
    );
  }

  return (
    <form action={ler} className="flex flex-col gap-4">
      <p className="text-muted">Tire uma fotografia à fatura. Lemos o valor, a data e o fornecedor, e confirma antes de guardar.</p>
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-surface p-4 text-center">
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previa} alt="Pré-visualização da fatura" className="max-h-72 rounded-md" />
        ) : (
          <>
            <span className="text-3xl" aria-hidden>📷</span>
            <span className="font-medium text-brand">Tirar fotografia ou escolher ficheiro</span>
          </>
        )}
        <input ref={entrada} name="foto" type="file" accept="image/*" capture="environment" onChange={aoEscolher} className="sr-only" />
      </label>
      {leitura.erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{leitura.erro}</p>}
      <button disabled={aLer || preparar || !previa} className={classeBotao}>
        {aLer ? "A ler a fatura…" : preparar ? "A preparar…" : "Ler fatura"}
      </button>
      <button type="button" onClick={() => setManual(true)} className="min-h-11 text-sm text-brand underline">
        Introduzir sem fotografia
      </button>
    </form>
  );
}

function Campo({ rotulo, aviso, children }: { rotulo: string; aviso?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {rotulo}
      {children}
      {aviso && <span className="rounded bg-warn-bg px-2 py-1 text-xs font-normal text-warn-ink">{aviso}</span>}
    </label>
  );
}

function Confirmar({ faturaPath, proposta, aviso, previa }: { faturaPath?: string; proposta?: PropostaDespesa; aviso?: string; previa: string | null }) {
  const [estado, guardar, aGuardar] = useActionState<EstadoGuardar, FormData>(guardarDespesaAction, {});
  const p: PropostaDespesa = proposta ?? { valorCent: null, data: null, fornecedor: null, nif: null, categoria: "outro", descricao: null, avisos: [] };
  const v = estado.valores;
  const aviso_ = (campo: string) => (v ? undefined : p.avisos.find((a) => a.campo === campo)?.mensagem);
  const lido = !!proposta && proposta.avisos.length < 4 && !aviso;

  return (
    <form action={guardar} className="flex flex-col gap-4">
      {aviso && <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-ink">{aviso}</p>}
      {lido && <p className="rounded-md bg-brand-soft px-3 py-2 text-sm text-info-ink">Dados lidos da fatura. Confirme cada campo antes de guardar.</p>}
      {previa && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previa} alt="Fatura" className="max-h-56 self-center rounded-md border border-line" />
      )}
      <input type="hidden" name="faturaPath" value={faturaPath ?? ""} />

      <Campo rotulo="Valor total (€)" aviso={aviso_("valor")}>
        <input name="valor" inputMode="decimal" required defaultValue={v?.valor ?? centParaTexto(p.valorCent)} className={classeCampo} placeholder="0,00" />
      </Campo>
      <Campo rotulo="Data da fatura" aviso={aviso_("data")}>
        <input name="data" type="date" required defaultValue={v?.data ?? p.data ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="Fornecedor" aviso={aviso_("fornecedor")}>
        <input name="fornecedor" defaultValue={v?.fornecedor ?? p.fornecedor ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="NIF do fornecedor" aviso={aviso_("nif")}>
        <input name="nif" inputMode="numeric" defaultValue={v?.nif ?? p.nif ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="Categoria" aviso={aviso_("categoria")}>
        <select name="categoria" defaultValue={v?.categoria ?? p.categoria} className={classeCampo}>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{ROTULOS[c]}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Descrição (opcional)" aviso={aviso_("descricao")}>
        <input name="descricao" defaultValue={v?.descricao ?? p.descricao ?? ""} className={classeCampo} />
      </Campo>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input name="recorrente" type="checkbox" defaultChecked={v?.recorrente === "true"} className="size-5" /> Despesa recorrente (marcação para referência)
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input name="pagaPeloFundo" type="checkbox" defaultChecked={v?.pagaPeloFundo === "true"} className="size-5" /> Paga pelo fundo de reserva
      </label>

      {estado.erro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{estado.erro}</p>}
      <button disabled={aGuardar} className={classeBotao}>{aGuardar ? "A guardar…" : "Guardar despesa"}</button>
    </form>
  );
}
