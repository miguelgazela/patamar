import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { sair } from "../entrar/actions";
import { FormularioOnboarding } from "./formulario";

export const metadata = { title: "Bem-vindo · Patamar" };

export default function BemVindo() {
  return (
    <Suspense fallback={<main role="status" className="mx-auto w-full max-w-md px-4 py-12 text-muted">A carregar…</main>}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  await connection();
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "desconhecido") redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand">Bem-vindo ao Patamar</h1>
          <p className="text-sm text-muted">Vamos configurar o seu condomínio. Demora cerca de 3 minutos e pode alterar tudo depois.</p>
        </div>
        <form action={sair}><button className="min-h-11 px-2 text-sm text-brand underline">Sair</button></form>
      </header>
      <FormularioOnboarding />
    </main>
  );
}
