import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { fracoesComPropriedade } from "@/lib/dados-migracao";
import { FormularioMigracao } from "./formulario";

export const metadata = { title: "Migrar do Excel · Patamar" };

export default function Migrar() {
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
  const fracoes = await fracoesComPropriedade(papel.condominioId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/quotas" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Quotas</Link>
        <h1 className="font-display text-2xl font-semibold">Migrar do Excel</h1>
        <p className="text-sm text-muted">
          Gere as quotas de vários meses de uma vez e registe o que cada fração já pagou. Comece, por exemplo, em janeiro do ano atual para que o relatório de contas desse ano fique completo.
        </p>
      </header>
      <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-ink">
        As despesas desse período não vêm com o saldo de abertura: registe-as (por fotografia ou à mão) para o saldo do condomínio refletir a realidade. Pode repetir esta importação sem duplicar pagamentos.
      </p>
      <FormularioMigracao fracoes={fracoes} deInicial={`${hoje.slice(0, 4)}-01`} ateInicial={hoje.slice(0, 7)} />
    </main>
  );
}
