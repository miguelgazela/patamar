import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { formatarData, hojeEmLisboa } from "@/lib/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Remover } from "../fracoes/formularios";
import { removerDocumentoAction } from "./actions";
import { CartaoDocumento } from "./cartao";

export const metadata = { title: "Documentos · Patamar" };

export default function Documentos() {
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
  const ano = Number(hoje.slice(0, 4));

  const supabase = await criarClienteServidor();
  const [fracoes, docs] = await Promise.all([
    supabase.from("fracoes").select("id, identificacao").eq("condominio_id", papel.condominioId).order("identificacao"),
    supabase.from("documentos").select("id, titulo, tipo, data").eq("condominio_id", papel.condominioId).order("data", { ascending: false }),
  ]);
  if (fracoes.error) throw fracoes.error;
  if (docs.error) throw docs.error;
  const anos = (a: number[]) => a.map((x) => ({ valor: String(x), rotulo: String(x) }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-2xl font-semibold">Documentos</h1>
        <p className="text-sm text-muted">PDFs gerados com os dados da plataforma. Reveja-os antes de os usar: são modelos de apoio e não substituem aconselhamento jurídico.</p>
      </header>

      <CartaoDocumento
        titulo="Relatório de contas anual"
        descricao="Receitas por mês, despesas por categoria, fundo de reserva e detalhe das despesas. Para apresentar na assembleia."
        tipo="relatorio"
        rotuloCampo="Ano"
        opcoes={anos([ano, ano - 1, ano - 2])}
        publicavel
      />
      <CartaoDocumento
        titulo="Modelo de ata"
        descricao="Ata da assembleia com o montante anual de cada condómino e as datas de vencimento, calculados a partir das definições do condomínio."
        tipo="ata"
        rotuloCampo="Ano das contribuições"
        opcoes={anos([ano + 1, ano])}
        publicavel
      />
      <CartaoDocumento
        titulo="Declaração de encargos e dívidas"
        descricao="Para a venda de uma fração: encargos anuais, quotas em dívida à data de hoje e campos a completar pelo administrador."
        tipo="declaracao"
        rotuloCampo="Fração"
        opcoes={fracoes.data.map((f) => ({ valor: f.id, rotulo: f.identificacao }))}
        publicavel={false}
      />

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Publicados no portal</h2>
        {docs.data.length === 0 ? (
          <p className="text-muted">Ainda não publicou documentos.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {docs.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div>
                  <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener" className="font-medium text-brand underline">{d.titulo}</a>
                  <p className="text-muted">{formatarData(d.data)}</p>
                </div>
                <Remover id={d.id} accao={removerDocumentoAction} aviso="O documento deixa de estar disponível para os condóminos." />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
