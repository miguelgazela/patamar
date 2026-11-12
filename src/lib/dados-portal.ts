import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { diasEntre, type Data } from "@/lib/datas";
import { estadoDaQuota, pagoPorQuota, saldoDaFracao, type Alocacao, type QuotaSaldo } from "@/lib/saldos";
import { lerTodas } from "@/lib/supabase/todas";

export interface QuotaPortal {
  id: string;
  mes: Data;
  valorCent: number;
  pagoCent: number;
  dataLimite: Data;
  estado: "pendente" | "parcial" | "paga" | "anulada";
  diasEmAtraso: number;
}

export interface FracaoPortal {
  id: string;
  identificacao: string;
  emDividaCent: number;
  pagoNoAnoCent: number;
  quotas: QuotaPortal[];
}

export interface PortalCondomino {
  nome: string;
  condominio: { nome: string; morada: string; iban: string | null };
  fracoes: FracaoPortal[];
  pagamentos: { id: string; data: Data; valorCent: number; meio: string; fracao: string }[];
  contas: { saldoCent: number; fundoReservaCent: number } | null;
  despesasPorCategoria: { categoria: string; totalCent: number }[];
  documentos: { id: string; titulo: string; tipo: string; data: Data }[];
}

/** Tudo o que um condómino pode ver. O isolamento é feito pela RLS, não por filtros aqui. */
export async function portalDoCondomino(condominioId: string, hoje: Data): Promise<PortalCondomino> {
  const supabase = await criarClienteServidor();
  const ano = Number(hoje.slice(0, 4));

  const [pessoa, cond, props, quotas, pq, pagamentos, contas, categorias, docs] = await Promise.all([
    supabase.from("pessoas").select("nome").limit(1).single(),
    supabase.from("condominios").select("nome, morada, iban").eq("id", condominioId).single(),
    supabase.from("propriedades").select("fracao_id, fracoes(identificacao)"),
    lerTodas(() => supabase.from("quotas").select("id, fracao_id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").order("mes", { ascending: false }).order("id")),
    lerTodas(() => supabase.from("pagamento_quotas").select("quota_id, valor_cent").order("pagamento_id").order("quota_id")),
    supabase.from("pagamentos").select("id, data, valor_cent, meio, fracoes(identificacao)").order("data", { ascending: false }).limit(5),
    supabase.rpc("contas_do_predio", { cond: condominioId }),
    supabase.rpc("despesas_por_categoria", { cond: condominioId, ano }),
    supabase.from("documentos").select("id, titulo, tipo, data").order("data", { ascending: false }),
  ]);
  for (const r of [pessoa, cond, props, quotas, pq, pagamentos, contas, categorias, docs]) if (r.error) throw r.error;

  const alocs: Alocacao[] = pq.data!.map((a) => ({ quotaId: a.quota_id, valorCent: a.valor_cent }));
  const pago = pagoPorQuota(alocs);

  const fracoes: FracaoPortal[] = props.data!.map((p) => {
    const id = p.fracao_id as string;
    const doFracao = quotas.data!.filter((q) => q.fracao_id === id);
    const lista: QuotaSaldo[] = doFracao.map((q) => ({
      id: q.id,
      mes: q.mes,
      valorCent: q.valor_cent,
      fundoReservaCent: q.fundo_reserva_cent,
      dataLimite: q.data_limite,
      anulada: q.estado === "anulada",
    }));
    const ids = new Set(lista.map((q) => q.id));
    const saldo = saldoDaFracao(lista, alocs.filter((a) => ids.has(a.quotaId)), hoje);
    return {
      id,
      identificacao: (p.fracoes as unknown as { identificacao: string } | null)?.identificacao ?? "",
      emDividaCent: saldo.emDividaCent,
      pagoNoAnoCent: lista.filter((q) => q.mes.startsWith(String(ano))).reduce((a, q) => a + Math.min(pago.get(q.id) ?? 0, q.valorCent), 0),
      quotas: lista.map((q) => {
        const pagoCent = Math.min(pago.get(q.id) ?? 0, q.valorCent);
        const estado = estadoDaQuota(q, pagoCent);
        return {
          id: q.id,
          mes: q.mes,
          valorCent: q.valorCent,
          pagoCent,
          dataLimite: q.dataLimite,
          estado,
          diasEmAtraso: estado !== "paga" && estado !== "anulada" && q.dataLimite < hoje ? diasEntre(q.dataLimite, hoje) : 0,
        };
      }),
    };
  });

  const c = contas.data?.[0];
  return {
    nome: pessoa.data!.nome,
    condominio: cond.data!,
    fracoes: fracoes.sort((a, b) => a.identificacao.localeCompare(b.identificacao)),
    pagamentos: pagamentos.data!.map((p) => ({
      id: p.id,
      data: p.data,
      valorCent: p.valor_cent,
      meio: p.meio,
      fracao: (p.fracoes as unknown as { identificacao: string } | null)?.identificacao ?? "",
    })),
    contas: c ? { saldoCent: Number(c.saldo_cent), fundoReservaCent: Number(c.fundo_reserva_cent) } : null,
    despesasPorCategoria: (categorias.data ?? []).map((r: { categoria: string; total_cent: number }) => ({ categoria: r.categoria, totalCent: Number(r.total_cent) })),
    documentos: docs.data!,
  };
}
