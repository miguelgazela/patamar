import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { eliminarCondominioAction, eliminarMinhaContaAction } from "./actions";
import { EliminarConta } from "./formularios";

export const metadata = { title: "Privacidade e dados · Patamar" };

export default function Conta() {
  return (
    <Suspense fallback={<main role="status" className="mx-auto w-full max-w-md px-4 py-12 text-muted">A carregar…</main>}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  await connection();
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo === "desconhecido") redirect("/");
  const supabase = await criarClienteServidor();
  const { data: cond } = await supabase.from("condominios").select("nome").eq("id", papel.condominioId).single();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Privacidade e dados</h1>
        <p className="text-sm text-muted">Veja a <Link href="/privacidade" className="text-brand underline">Política de privacidade</Link> e os <Link href="/termos" className="text-brand underline">Termos</Link>.</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Exportar os meus dados</h2>
        <p className="text-sm text-muted">
          {papel.tipo === "administrador"
            ? "Descarregue uma cópia (JSON) de todos os dados do condomínio: frações, pessoas, quotas, pagamentos, despesas, documentos, lembretes e registo de atividade."
            : "Descarregue uma cópia (JSON) dos seus dados: a sua ficha, as suas frações, quotas, pagamentos e os documentos a que tem acesso."}
        </p>
        <a href="/api/conta/exportar" download className="flex min-h-11 w-fit items-center rounded-md bg-brand px-4 py-2 font-semibold text-on-brand hover:bg-brand-hover">Descarregar os dados</a>
      </section>

      {papel.tipo === "condomino" ? (
        <section className="flex flex-col gap-3 rounded-lg border border-bad bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-bad-ink">Eliminar a minha conta</h2>
          <p className="text-sm text-muted">
            Remove o seu acesso e apaga os seus dados pessoais (nome, email, telemóvel e NIF). Os registos de quotas e pagamentos da sua fração ficam no condomínio, sem a identificar, porque o condomínio tem de os conservar. Não pode ser desfeito.
          </p>
          <EliminarConta accao={eliminarMinhaContaAction} instrucao="Escreva ELIMINAR para confirmar" rotuloBotao="Eliminar a minha conta" />
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-lg border border-bad bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-bad-ink">Eliminar o condomínio</h2>
          <p className="text-sm text-muted">
            Apaga <strong>todos</strong> os dados do condomínio: frações, pessoas, quotas, pagamentos, despesas, faturas, documentos e as contas de acesso de todos os condóminos. Não pode ser desfeito. Exporte primeiro os dados, se precisar deles.
          </p>
          <EliminarConta accao={eliminarCondominioAction} instrucao={`Escreva o nome do condomínio («${cond?.nome ?? ""}») para confirmar`} rotuloBotao="Eliminar o condomínio e todos os dados" />
        </section>
      )}
    </main>
  );
}
