"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/admin";
import { alocarPagamento, type QuotaSaldo } from "@/lib/saldos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerTodas } from "@/lib/supabase/todas";

const MapeamentoSchema = z.object({
  data: z.string().min(1).max(120),
  descricao: z.string().min(1).max(120),
  modo: z.enum(["valor", "credito_debito"]),
  valor: z.string().max(120).optional(),
  credito: z.string().max(120).optional(),
  debito: z.string().max(120).optional(),
});

export async function guardarMapeamentoAction(mapeamento: unknown): Promise<{ ok: boolean }> {
  const papel = await exigirAdmin();
  const m = MapeamentoSchema.safeParse(mapeamento);
  if (!m.success) return { ok: false };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("condominios").update({ mapeamento_extrato: m.data }).eq("id", papel.condominioId);
  return { ok: !error };
}

const LinhaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valorCent: z.number().int().positive(),
  descricao: z.string().max(300),
  chave: z.string().min(1).max(500),
  // Regex em vez de z.uuid(): aceita também os ids fixos do seed, que não têm bits de versão.
  fracaoId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
});

export interface ResultadoImportacao {
  registados: number;
  duplicados: number;
  erros: { chave: string; mensagem: string }[];
  erroGeral?: string;
}

/** Confirma os pagamentos escolhidos. A distribuição pelas quotas é recalculada aqui, com o estado atual da base de dados. */
export async function importarAction(linhas: unknown): Promise<ResultadoImportacao> {
  const papel = await exigirAdmin();
  const lidas = z.array(LinhaSchema).max(500).safeParse(linhas);
  if (!lidas.success) return { registados: 0, duplicados: 0, erros: [], erroGeral: "Dados inválidos." };
  const entradas = lidas.data;
  if (entradas.length === 0) return { registados: 0, duplicados: 0, erros: [] };

  const supabase = await criarClienteServidor();
  const fracaoIds = [...new Set(entradas.map((l) => l.fracaoId))];
  const [quotas, pq] = await Promise.all([
    lerTodas(() => supabase.from("quotas").select("id, fracao_id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").eq("condominio_id", papel.condominioId).in("fracao_id", fracaoIds).order("id")),
    lerTodas(() => supabase.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", papel.condominioId).order("pagamento_id").order("quota_id")),
  ]);
  if (quotas.error || pq.error) return { registados: 0, duplicados: 0, erros: [], erroGeral: "Não foi possível ler as quotas." };

  const jaPago = new Map<string, number>();
  pq.data.forEach((a) => jaPago.set(a.quota_id, (jaPago.get(a.quota_id) ?? 0) + a.valor_cent));
  const porFracao = new Map<string, QuotaSaldo[]>();
  quotas.data.forEach((q) => {
    const lista = porFracao.get(q.fracao_id) ?? [];
    lista.push({ id: q.id, mes: q.mes, valorCent: q.valor_cent, fundoReservaCent: q.fundo_reserva_cent, dataLimite: q.data_limite, anulada: q.estado === "anulada" });
    porFracao.set(q.fracao_id, lista);
  });

  const out: ResultadoImportacao = { registados: 0, duplicados: 0, erros: [] };
  // Cronológico, para que pagamentos antigos fiquem com as quotas mais antigas.
  for (const l of [...entradas].sort((a, b) => a.data.localeCompare(b.data) || a.chave.localeCompare(b.chave))) {
    const { alocacoes, creditoCent } = alocarPagamento(l.valorCent, porFracao.get(l.fracaoId) ?? [], jaPago);
    if (alocacoes.length === 0 || creditoCent > 0) {
      out.erros.push({ chave: l.chave, mensagem: alocacoes.length === 0 ? "Sem quotas por pagar nesta fração." : "O valor excede o que está por pagar." });
      continue;
    }
    const { error } = await supabase.rpc("registar_pagamento", {
      p_condominio: papel.condominioId,
      p_fracao: l.fracaoId,
      p_valor: l.valorCent,
      p_data: l.data,
      p_meio: "transferencia",
      p_referencia: l.descricao.slice(0, 200) || null,
      p_alocacoes: alocacoes.map((a) => ({ quota_id: a.quotaId, valor_cent: a.valorCent })),
      p_chave: l.chave,
    });
    if (error) {
      if (error.code === "23505") out.duplicados++;
      else out.erros.push({ chave: l.chave, mensagem: "Não foi possível registar." });
      continue;
    }
    alocacoes.forEach((a) => jaPago.set(a.quotaId, (jaPago.get(a.quotaId) ?? 0) + a.valorCent));
    out.registados++;
  }

  if (out.registados > 0) {
    await supabase.from("registo_atividade").insert({
      condominio_id: papel.condominioId,
      pessoa_id: papel.pessoaId,
      acao: "extrato.importado",
      entidade: "pagamentos",
      detalhe: { registados: out.registados, duplicados: out.duplicados, erros: out.erros.length },
    });
  }
  revalidatePath("/extrato");
  revalidatePath("/quotas");
  revalidatePath("/");
  return out;
}
