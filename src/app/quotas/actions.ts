"use server";

import { revalidatePath } from "next/cache";
import { papelDoUtilizador } from "@/lib/dados";
import { dataValida, hojeEmLisboa } from "@/lib/datas";
import { lerEuros } from "@/lib/money";
import { gerarQuotasParaMeses } from "@/lib/quotas-geracao";
import { alocarPagamento, type QuotaSaldo } from "@/lib/saldos";
import { formatarEuros } from "@/lib/money";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";
import { lerTodas } from "@/lib/supabase/todas";

async function exigirAdmin() {
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "administrador") throw new Error("Sem permissão.");
  return papel;
}

const MES = /^\d{4}-\d{2}-01$/;

export type EstadoAccao = EstadoForm;

export async function gerarQuotasAction(_: EstadoAccao, dados: FormData): Promise<EstadoAccao> {
  const papel = await exigirAdmin();
  const mes = String(dados.get("mes") ?? "");
  if (!MES.test(mes)) return { erro: "Mês inválido." };

  const supabase = await criarClienteServidor();
  const r = await gerarQuotasParaMeses(supabase, papel.condominioId, [mes]);
  if ("erro" in r) return { erro: r.erro };

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId,
    pessoa_id: papel.pessoaId,
    acao: "quotas.geradas",
    entidade: "quotas",
    detalhe: { mes, criadas: r.criadas },
  });
  revalidatePath("/quotas");
  return { ok: "Quotas geradas." };
}

export async function registarPagamentoAction(_: EstadoAccao, dados: FormData): Promise<EstadoAccao> {
  const papel = await exigirAdmin();
  const fracaoId = String(dados.get("fracaoId") ?? "");
  const valorCent = lerEuros(String(dados.get("valor") ?? ""));
  const data = String(dados.get("data") ?? "");
  const meio = String(dados.get("meio") ?? "transferencia");
  const referencia = String(dados.get("referencia") ?? "").trim() || null;

  if (valorCent === null || valorCent <= 0) return { erro: "Indique um valor válido, por exemplo 45,00." };
  if (!dataValida(data)) return { erro: "Indique a data do pagamento." };
  if (data > hojeEmLisboa()) return { erro: "A data do pagamento não pode ser futura." };
  if (!["transferencia", "numerario", "cheque", "outro"].includes(meio)) return { erro: "Meio de pagamento inválido." };

  const supabase = await criarClienteServidor();
  const [quotas, pq] = await Promise.all([
    supabase.from("quotas").select("id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").eq("fracao_id", fracaoId),
    lerTodas(() => supabase.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", papel.condominioId).order("pagamento_id").order("quota_id")),
  ]);
  if (quotas.error || pq.error || quotas.data.length === 0) return { erro: "Fração sem quotas geradas." };

  const lista: QuotaSaldo[] = quotas.data.map((q) => ({
    id: q.id,
    mes: q.mes,
    valorCent: q.valor_cent,
    fundoReservaCent: q.fundo_reserva_cent,
    dataLimite: q.data_limite,
    anulada: q.estado === "anulada",
  }));
  const jaPago = new Map<string, number>();
  pq.data.forEach((a) => jaPago.set(a.quota_id, (jaPago.get(a.quota_id) ?? 0) + a.valor_cent));

  const { alocacoes, creditoCent } = alocarPagamento(valorCent, lista, jaPago);
  if (creditoCent > 0) {
    const emDivida = valorCent - creditoCent;
    return {
      erro: emDivida > 0
        ? `O valor excede em ${formatarEuros(creditoCent)} o que está por pagar (${formatarEuros(emDivida)}). Gere primeiro as quotas dos meses seguintes.`
        : "Não há quotas por pagar nesta fração. Gere primeiro as quotas dos meses seguintes.",
    };
  }

  const { error } = await supabase.rpc("registar_pagamento", {
    p_condominio: papel.condominioId,
    p_fracao: fracaoId,
    p_valor: valorCent,
    p_data: data,
    p_meio: meio,
    p_referencia: referencia,
    p_alocacoes: alocacoes.map((a) => ({ quota_id: a.quotaId, valor_cent: a.valorCent })),
  });
  if (error) return { erro: "Não foi possível registar o pagamento. Tente de novo." };

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId,
    pessoa_id: papel.pessoaId,
    acao: "pagamento.registado",
    entidade: "pagamentos",
    detalhe: { fracao_id: fracaoId, valor_cent: valorCent, quotas: alocacoes.length, meio },
  });
  revalidatePath("/quotas");
  revalidatePath("/");
  return { ok: "Pagamento registado." };
}
