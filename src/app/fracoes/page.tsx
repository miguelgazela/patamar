import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { listarFracoes } from "@/lib/dados-fracoes";
import { hojeEmLisboa } from "@/lib/datas";
import { estadoPermilagem, ROTULOS_TIPO, type TipoFracao } from "@/lib/fracoes";
import { removerAnexoAction, removerFracaoAction } from "./actions";
import { FormFracao, NovoAnexo, Remover } from "./formularios";

export const metadata = { title: "Frações · Patamar" };

export default function Fracoes() {
  return (
    <Suspense fallback={<main role="status" className="mx-auto w-full max-w-md px-4 py-12 text-muted">A carregar…</main>}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  await connection();
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "administrador") redirect("/");
  const fracoes = await listarFracoes(papel.condominioId);
  const perm = estadoPermilagem(fracoes.map((f) => f.permilagem));
  const fmt = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });

  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Frações</h1>
      </header>

      {fracoes.length > 0 && (
        <p className={`rounded-md px-3 py-2 text-sm ${perm.estado === "ok" ? "bg-ok-bg text-ok-ink" : "bg-warn-bg text-warn-ink"}`}>
          {perm.estado === "ok"
            ? "A soma das permilagens é 1000 ‰."
            : `A soma das permilagens é ${fmt(perm.somaPermilagem)} ‰ (${perm.estado === "falta" ? `faltam ${fmt(perm.diferenca)}` : `excede em ${fmt(-perm.diferenca)}`} ‰). Num prédio em propriedade horizontal deve somar 1000 ‰; confirme no título constitutivo.`}
        </p>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {fracoes.map((f) => (
          <li key={f.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{f.identificacao}</p>
                <p className="text-sm text-muted">{ROTULOS_TIPO[f.tipo as TipoFracao] ?? f.tipo} · {fmt(f.permilagem)} ‰</p>
                <p className="text-sm text-muted">{f.proprietarios.join(", ") || "Sem proprietário"}</p>
                {f.anexos.length > 0 && <p className="text-sm text-muted">{f.anexos.map((a) => a.identificacao).join(", ")}</p>}
              </div>
            </div>
            <details className="mt-2 rounded-md border border-line bg-surface-2 p-3">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand">Editar</summary>
              <div className="mt-2 flex flex-col gap-4">
                <FormFracao fracao={f} />
                <div>
                  <h3 className="text-sm font-semibold">Anexos (box, arrecadação)</h3>
                  <ul className="divide-y divide-line">
                    {f.anexos.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <span>{a.tipo === "box" ? "Box" : "Arrecadação"} · {a.identificacao}</span>
                        <Remover id={a.id} accao={removerAnexoAction} />
                      </li>
                    ))}
                  </ul>
                  <NovoAnexo fracaoId={f.id} />
                </div>
                <div className="border-t border-line pt-2">
                  {f.temHistorico ? (
                    <p className="text-xs text-muted">Esta fração tem quotas ou pagamentos registados e não pode ser removida.</p>
                  ) : (
                    <Remover id={f.id} accao={removerFracaoAction} rotulo="Remover fração" aviso="A fração e os seus anexos serão apagados." />
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <details className="rounded-lg border border-line bg-surface p-4" open={fracoes.length === 0}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand">Nova fração</summary>
        <div className="mt-2"><FormFracao /></div>
      </details>
    </main>
  );
}
