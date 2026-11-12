import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { dadosDoExtrato } from "@/lib/dados-extrato";
import { hojeEmLisboa } from "@/lib/datas";
import { Importador } from "./importador";

export const metadata = { title: "Extrato · Patamar" };

export default function Extrato() {
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
  const d = await dadosDoExtrato(papel.condominioId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Importar extrato</h1>
        <p className="text-sm text-muted">Carregue o extrato do banco. Sugerimos a que fração e quota corresponde cada transferência, e confirma antes de registar.</p>
      </header>
      <Importador fracoes={d.fracoes} historico={d.historico} chavesExistentes={d.chavesExistentes} mapeamentoGuardado={d.mapeamento} />
    </main>
  );
}
