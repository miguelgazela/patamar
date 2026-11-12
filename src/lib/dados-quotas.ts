import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { diasEntre, type Data } from "@/lib/datas";
import { estadoDaQuota, pagoPorQuota, saldoDaFracao, type Alocacao, type QuotaSaldo } from "@/lib/saldos";
import { lerTodas } from "@/lib/supabase/todas";

export interface LinhaQuota {
  fracaoId: string;
  identificacao: string;
  proprietarios: string[];
  quotaId: string | null;
  valorCent: number;
  pagoCent: number;
  estado: "pendente" | "parcial" | "paga" | "anulada";
  dataLimite: Data | null;
  diasEmAtraso: number;
  /** Dívida total da fração (todas as quotas vencidas, qualquer mês). */
  dividaTotalCent: number;
}

export interface QuotasDoMes {
  mes: Data;
  geradas: boolean;
  linhas: LinhaQuota[];
  emitidoCent: number;
  recebidoCent: number;
}

export async function quotasDoMes(condominioId: string, mes: Data, hoje: Data): Promise<QuotasDoMes> {
  const supabase = await criarClienteServidor();
  const [fracoes, quotas, pq, props] = await Promise.all([
    supabase.from("fracoes").select("id, identificacao").eq("condominio_id", condominioId).order("identificacao"),
    lerTodas(() => supabase.from("quotas").select("id, fracao_id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").eq("condominio_id", condominioId).order("id")),
    lerTodas(() => supabase.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", condominioId).order("pagamento_id").order("quota_id")),
    supabase.from("propriedades").select("fracao_id, pessoas(nome)").eq("condominio_id", condominioId),
  ]);
  for (const r of [fracoes, quotas, pq, props]) if (r.error) throw r.error;

  const todas = quotas.data!.map((q) => ({
    fracaoId: q.fracao_id as string,
    q: {
      id: q.id as string,
      mes: q.mes as string,
      valorCent: q.valor_cent as number,
      fundoReservaCent: q.fundo_reserva_cent as number,
      dataLimite: q.data_limite as string,
      anulada: q.estado === "anulada",
    } satisfies QuotaSaldo,
  }));
  const alocs: Alocacao[] = pq.data!.map((a) => ({ quotaId: a.quota_id, valorCent: a.valor_cent }));
  const pago = pagoPorQuota(alocs);

  const linhas: LinhaQuota[] = fracoes.data!.map((f) => {
    const doFracao = todas.filter((t) => t.fracaoId === f.id).map((t) => t.q);
    const ids = new Set(doFracao.map((q) => q.id));
    const divida = saldoDaFracao(doFracao, alocs.filter((a) => ids.has(a.quotaId)), hoje).emDividaCent;
    const q = doFracao.find((x) => x.mes === mes) ?? null;
    const pagoCent = q ? Math.min(pago.get(q.id) ?? 0, q.valorCent) : 0;
    const estado = q ? estadoDaQuota(q, pagoCent) : "pendente";
    return {
      fracaoId: f.id,
      identificacao: f.identificacao,
      proprietarios: props.data!
        .filter((p) => p.fracao_id === f.id)
        .map((p) => (p.pessoas as unknown as { nome: string } | null)?.nome)
        .filter((n): n is string => !!n),
      quotaId: q?.id ?? null,
      valorCent: q?.valorCent ?? 0,
      pagoCent,
      estado,
      dataLimite: q?.dataLimite ?? null,
      diasEmAtraso: q && estado !== "paga" && q.dataLimite < hoje ? diasEntre(q.dataLimite, hoje) : 0,
      dividaTotalCent: divida,
    };
  });

  return {
    mes,
    geradas: linhas.some((l) => l.quotaId),
    linhas,
    emitidoCent: linhas.reduce((a, l) => a + l.valorCent, 0),
    recebidoCent: linhas.reduce((a, l) => a + l.pagoCent, 0),
  };
}
