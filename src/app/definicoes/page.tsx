import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { formatarIban } from "@/lib/iban";
import { criarClienteServidor } from "@/lib/supabase/server";
import { FormDefinicoes } from "./formulario";

export const metadata = { title: "Definições · Patamar" };

export default function Definicoes() {
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

  const supabase = await criarClienteServidor();
  const { data: c, error } = await supabase.from("condominios").select("*").eq("id", papel.condominioId).single();
  if (error) throw error;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Definições</h1>
      </header>
      <FormDefinicoes
        key={JSON.stringify([c.nome, c.morada, c.nif, c.iban, c.modo_quota, c.valor_quota_cent, c.fundo_reserva_pct, c.dia_vencimento])}
        d={{
          nome: c.nome,
          morada: c.morada,
          nif: c.nif,
          iban: c.iban ? formatarIban(c.iban) : null,
          modo: c.modo_quota,
          valor: (c.valor_quota_cent / 100).toFixed(2).replace(".", ","),
          fundo: String(Number(c.fundo_reserva_pct)).replace(".", ","),
          dia: c.dia_vencimento,
        }}
      />
    </main>
  );
}
