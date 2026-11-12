import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Data } from "@/lib/datas";
import { estadoPermilagem } from "@/lib/fracoes";
import { gerarQuotasDoMes } from "@/lib/quotas";

/**
 * Gera as quotas dos meses indicados com a configuração atual do condomínio. Idempotente:
 * quotas que já existem (fração + mês) não são alteradas. Devolve quantas foram criadas.
 */
export async function gerarQuotasParaMeses(sb: SupabaseClient, condominioId: string, listaMeses: Data[]): Promise<{ criadas: number } | { erro: string }> {
  const [cond, fracoes] = await Promise.all([
    sb.from("condominios").select("modo_quota, valor_quota_cent, fundo_reserva_pct, dia_vencimento").eq("id", condominioId).single(),
    sb.from("fracoes").select("id, permilagem").eq("condominio_id", condominioId),
  ]);
  if (cond.error || fracoes.error || fracoes.data.length === 0) return { erro: "Não foi possível ler a configuração do condomínio. Crie primeiro as frações." };

  if (cond.data.modo_quota === "permilagem") {
    const p = estadoPermilagem(fracoes.data.map((f) => Number(f.permilagem)));
    if (p.estado !== "ok") {
      return { erro: `A soma das permilagens é ${p.somaPermilagem.toLocaleString("pt-PT", { maximumFractionDigits: 3 })} ‰ e deve ser 1000 ‰. Corrija em «Frações» antes de gerar quotas repartidas pela permilagem.` };
    }
  }

  const config = {
    modo: cond.data.modo_quota as "fixa" | "permilagem",
    valorQuotaCent: cond.data.valor_quota_cent as number,
    fundoReservaPct: Number(cond.data.fundo_reserva_pct),
    diaVencimento: cond.data.dia_vencimento as number,
  };
  const pesos = fracoes.data.map((f) => ({ id: f.id as string, permilagem: Number(f.permilagem) }));
  const linhas = listaMeses.flatMap((mes) =>
    gerarQuotasDoMes(mes, config, pesos).map((q) => ({
      condominio_id: condominioId,
      fracao_id: q.fracaoId,
      mes: q.mes,
      valor_cent: q.valorCent,
      fundo_reserva_cent: q.fundoReservaCent,
      data_limite: q.dataLimite,
    })),
  );

  let criadas = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const { data, error } = await sb.from("quotas").upsert(linhas.slice(i, i + 500), { onConflict: "fracao_id,mes", ignoreDuplicates: true }).select("id");
    if (error) return { erro: "Não foi possível gerar as quotas." };
    criadas += data?.length ?? 0;
  }
  return { criadas };
}
