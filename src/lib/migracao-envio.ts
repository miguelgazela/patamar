import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Data } from "@/lib/datas";
import { dataDoSaldo } from "@/lib/migracao";
import { formatarEuros, lerEuros } from "@/lib/money";
import { gerarQuotasParaMeses } from "@/lib/quotas-geracao";
import { alocarPagamento, type QuotaSaldo } from "@/lib/saldos";
import { lerTodas } from "@/lib/supabase/todas";

export interface ResultadoMigracao {
  erroGeral?: string;
  quotasCriadas: number;
  pagamentos: number;
  duplicados: number;
  erros: { fracao: string; mensagem: string }[];
}

export const resultadoVazio = (erroGeral?: string): ResultadoMigracao => ({ erroGeral, quotasCriadas: 0, pagamentos: 0, duplicados: 0, erros: [] });

/**
 * Migração do Excel: gera as quotas dos meses e regista, por fração, um único pagamento «saldo de abertura»
 * com o que já foi pago, distribuído pelas quotas mais antigas. Pode repetir-se sem duplicar.
 * `valores`: texto em euros por id de fração (vazio = nada a registar).
 */
export async function executarMigracao(
  supabase: SupabaseClient,
  ctx: { condominioId: string; pessoaId: string | null; hoje: Data; de: Data; ate: Data; meses: Data[] },
  valores: Record<string, string>,
): Promise<ResultadoMigracao> {
  const { condominioId, hoje, de, ate } = ctx;
  const papel = { condominioId, pessoaId: ctx.pessoaId };
  const intervalo = { meses: ctx.meses };
  const geradas = await gerarQuotasParaMeses(supabase, papel.condominioId, intervalo.meses);
  if ("erro" in geradas) return resultadoVazio(geradas.erro);
  const out: ResultadoMigracao = { ...resultadoVazio(), quotasCriadas: geradas.criadas };

  // Valores pagos por fração (campos valor_<id>); vazio = nada a registar.
  const { data: fracoes, error } = await supabase.from("fracoes").select("id, identificacao").eq("condominio_id", papel.condominioId);
  if (error) return { ...out, erroGeral: "Não foi possível ler as frações." };
  const pedidos = fracoes
    .map((f) => ({ f, texto: (valores[f.id] ?? "").trim() }))
    .filter((x) => x.texto !== "");
  if (pedidos.length === 0) return out;

  const [quotas, pq] = await Promise.all([
    lerTodas<{ id: string; fracao_id: string; mes: string; valor_cent: number; fundo_reserva_cent: number; data_limite: string; estado: string }>(() =>
      supabase.from("quotas").select("id, fracao_id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").eq("condominio_id", papel.condominioId).gte("mes", de).lte("mes", ate).order("id"),
    ),
    lerTodas<{ quota_id: string; valor_cent: number }>(() => supabase.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", papel.condominioId).order("pagamento_id").order("quota_id")),
  ]);
  if (quotas.error || pq.error) return { ...out, erroGeral: "Não foi possível ler as quotas." };

  const jaPago = new Map<string, number>();
  pq.data.forEach((a) => jaPago.set(a.quota_id, (jaPago.get(a.quota_id) ?? 0) + a.valor_cent));
  const dataPagamento = dataDoSaldo(ate, hoje);

  for (const { f, texto } of pedidos) {
    const valorCent = lerEuros(texto);
    if (valorCent === null || valorCent < 0) {
      out.erros.push({ fracao: f.identificacao, mensagem: "Valor inválido." });
      continue;
    }
    if (valorCent === 0) continue;

    const lista: QuotaSaldo[] = quotas.data
      .filter((q) => q.fracao_id === f.id && q.estado !== "anulada")
      .map((q) => ({ id: q.id, mes: q.mes, valorCent: q.valor_cent, fundoReservaCent: q.fundo_reserva_cent, dataLimite: q.data_limite }));
    const { alocacoes, creditoCent } = alocarPagamento(valorCent, lista, jaPago);
    if (alocacoes.length === 0 || creditoCent > 0) {
      const total = lista.reduce((a, q) => a + Math.max(0, q.valorCent - (jaPago.get(q.id) ?? 0)), 0);
      out.erros.push({ fracao: f.identificacao, mensagem: `O valor excede o que há por pagar no período (${formatarEuros(total)}).` });
      continue;
    }

    const { error: erroPag } = await supabase.rpc("registar_pagamento", {
      p_condominio: papel.condominioId,
      p_fracao: f.id,
      p_valor: valorCent,
      p_data: dataPagamento,
      p_meio: "outro",
      p_referencia: "Saldo de abertura (migração)",
      p_alocacoes: alocacoes.map((a) => ({ quota_id: a.quotaId, valor_cent: a.valorCent })),
      p_chave: `abertura|${f.id}|${de}|${ate}`,
    });
    if (erroPag) {
      if (erroPag.code === "23505") out.duplicados++;
      else out.erros.push({ fracao: f.identificacao, mensagem: "Não foi possível registar." });
      continue;
    }
    alocacoes.forEach((a) => jaPago.set(a.quotaId, (jaPago.get(a.quotaId) ?? 0) + a.valorCent));
    out.pagamentos++;
  }

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId,
    pessoa_id: papel.pessoaId,
    acao: "migracao.historico",
    entidade: "quotas",
    detalhe: { de, ate, quotas_criadas: out.quotasCriadas, pagamentos: out.pagamentos, duplicados: out.duplicados, erros: out.erros.length },
  });
  return out;
}
