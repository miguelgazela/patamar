import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { listarPessoas } from "@/lib/dados-condominos";
import { hojeEmLisboa } from "@/lib/datas";
import { listarFracoes } from "@/lib/dados-fracoes";
import { Remover } from "../fracoes/formularios";
import { removerPessoaAction } from "./actions-pessoas";
import { Convidar } from "./formulario";
import { FormPessoa } from "./formulario-pessoa";

export const metadata = { title: "Condóminos · Patamar" };

const ACESSO = {
  sem_acesso: { texto: "Sem acesso", classe: "bg-surface-2 text-muted" },
  convidado: { texto: "Convidado", classe: "bg-warn-bg text-warn-ink" },
  ativo: { texto: "Ativo", classe: "bg-ok-bg text-ok-ink" },
} as const;

export default function Condominos() {
  return (
    <Suspense fallback={<main role="status" className="mx-auto w-full max-w-md px-4 py-12 text-muted">A carregar…</main>}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  await connection();
  const hoje = hojeEmLisboa();
  const papel = await papelDoUtilizador(hoje);
  if (papel.tipo !== "administrador") redirect("/");
  const [pessoas, fracoes] = await Promise.all([listarPessoas(papel.condominioId, hoje), listarFracoes(papel.condominioId)]);
  const opcoes = fracoes.map((f) => ({ id: f.id, identificacao: f.identificacao }));

  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Condóminos</h1>
        <p className="text-sm text-muted">Convide cada condómino para ver o seu saldo e as contas do prédio. Entra com o email, por código, sem palavra-passe.</p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {pessoas.map((p) => {
          const a = ACESSO[p.acesso];
          return (
            <li key={p.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{p.nome}{p.administrador && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">Administrador</span>}</p>
                  <p className="text-sm text-muted">{p.fracoes.join(", ") || "Sem fração"}</p>
                  {p.email && <p className="text-sm text-muted">{p.email}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${a.classe}`}>{a.texto}</span>
              </div>
              {!p.administrador && <Convidar pessoaId={p.id} email={p.email} acesso={p.acesso} />}
              <details className="mt-3 rounded-md border border-line bg-surface-2 p-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand">Editar dados e frações</summary>
                <div className="mt-2 flex flex-col gap-3">
                  <FormPessoa fracoes={opcoes} pessoa={p} />
                  {!p.administrador && (
                    <Remover id={p.id} accao={removerPessoaAction} rotulo="Remover pessoa" aviso={p.acesso === "sem_acesso" ? "A pessoa será removida." : "A pessoa será removida e perde o acesso à app."} />
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      <details className="rounded-lg border border-line bg-surface p-4" open={pessoas.length === 0}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand">Nova pessoa</summary>
        <div className="mt-2"><FormPessoa fracoes={opcoes} /></div>
      </details>
    </main>
  );
}
