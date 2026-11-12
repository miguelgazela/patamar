import "server-only";
import type { FracaoInfo, Historico } from "@/lib/extrato/sugerir";
import type { Mapeamento } from "@/lib/extrato/parse";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerTodas } from "@/lib/supabase/todas";

export interface DadosExtrato {
  fracoes: FracaoInfo[];
  historico: Historico[];
  chavesExistentes: string[];
  mapeamento: Mapeamento | null;
}

export async function dadosDoExtrato(condominioId: string): Promise<DadosExtrato> {
  const supabase = await criarClienteServidor();
  const [fracoes, quotas, pq, props, pagamentos, cond] = await Promise.all([
    supabase.from("fracoes").select("id, identificacao").eq("condominio_id", condominioId).order("identificacao"),
    lerTodas(() => supabase.from("quotas").select("id, fracao_id, mes, valor_cent, estado").eq("condominio_id", condominioId).order("mes").order("id")),
    lerTodas(() => supabase.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", condominioId).order("pagamento_id").order("quota_id")),
    supabase.from("propriedades").select("fracao_id, pessoas(nome)").eq("condominio_id", condominioId),
    supabase.from("pagamentos").select("fracao_id, referencia_extrato, extrato_chave").eq("condominio_id", condominioId).not("extrato_chave", "is", null).order("data", { ascending: false }).limit(1000),
    supabase.from("condominios").select("mapeamento_extrato").eq("id", condominioId).single(),
  ]);
  for (const r of [fracoes, quotas, pq, props, pagamentos, cond]) if (r.error) throw r.error;

  const pago = new Map<string, number>();
  pq.data!.forEach((a) => pago.set(a.quota_id, (pago.get(a.quota_id) ?? 0) + a.valor_cent));

  return {
    fracoes: fracoes.data!.map((f) => {
      const doFracao = quotas.data!.filter((q) => q.fracao_id === f.id && q.estado !== "anulada");
      return {
        id: f.id,
        identificacao: f.identificacao,
        proprietarios: props.data!
          .filter((p) => p.fracao_id === f.id)
          .map((p) => (p.pessoas as unknown as { nome: string } | null)?.nome)
          .filter((n): n is string => !!n),
        quotasAbertas: doFracao
          .map((q) => ({ id: q.id as string, mes: q.mes as string, restanteCent: (q.valor_cent as number) - (pago.get(q.id) ?? 0) }))
          .filter((q) => q.restanteCent > 0),
        quotaMensalCent: doFracao.length > 0 ? (doFracao[doFracao.length - 1].valor_cent as number) : 0,
      };
    }),
    historico: pagamentos.data!.filter((p) => p.referencia_extrato).map((p) => ({ descricao: p.referencia_extrato as string, fracaoId: p.fracao_id as string })),
    chavesExistentes: pagamentos.data!.map((p) => p.extrato_chave as string),
    mapeamento: (cond.data!.mapeamento_extrato as Mapeamento | null) ?? null,
  };
}
