import "server-only";
import { valoresDaQuota } from "@/lib/quotas";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function fracoesComPropriedade(condominioId: string) {
  const sb = await criarClienteServidor();
  const [cond, fracoes, props] = await Promise.all([
    sb.from("condominios").select("modo_quota, valor_quota_cent, fundo_reserva_pct, dia_vencimento").eq("id", condominioId).single(),
    sb.from("fracoes").select("id, identificacao, permilagem").eq("condominio_id", condominioId).order("identificacao"),
    sb.from("propriedades").select("fracao_id, pessoas(nome)").eq("condominio_id", condominioId),
  ]);
  for (const r of [cond, fracoes, props]) if (r.error) throw r.error;
  const mensal = valoresDaQuota(
    { modo: cond.data!.modo_quota, valorQuotaCent: cond.data!.valor_quota_cent, fundoReservaPct: Number(cond.data!.fundo_reserva_pct), diaVencimento: cond.data!.dia_vencimento },
    fracoes.data!.map((f) => ({ id: f.id, permilagem: Number(f.permilagem) })),
  );
  return fracoes.data!.map((f) => ({
    id: f.id as string,
    identificacao: f.identificacao as string,
    proprietarios: props.data!.filter((p) => p.fracao_id === f.id).map((p) => (p.pessoas as unknown as { nome: string } | null)?.nome).filter((n): n is string => !!n),
    quotaMensalCent: mensal.get(f.id) ?? 0,
  }));
}
