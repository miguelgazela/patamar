import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { atrasoDaFracao, contasDoPredio, saldoDaFracao, type Alocacao, type QuotaSaldo } from "@/lib/saldos";
import { primeiroDoMes, type Data } from "@/lib/datas";
import { lerTodas } from "@/lib/supabase/todas";

export type Papel = { tipo: "administrador"; condominioId: string; pessoaId: string } | { tipo: "condomino"; condominioId: string; pessoaId: string } | { tipo: "desconhecido" };

export async function papelDoUtilizador(hoje: Data): Promise<Papel> {
  const supabase = await criarClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) return { tipo: "desconhecido" };

  const { data: pessoa } = await supabase.from("pessoas").select("id, condominio_id").eq("auth_user_id", uid).maybeSingle();
  if (!pessoa) return { tipo: "desconhecido" };

  const { data: adm } = await supabase
    .from("administracoes")
    .select("id")
    .eq("pessoa_id", pessoa.id)
    .lte("inicio", hoje)
    .or(`fim.is.null,fim.gte.${hoje}`)
    .limit(1);
  return adm && adm.length > 0
    ? { tipo: "administrador", condominioId: pessoa.condominio_id, pessoaId: pessoa.id }
    : { tipo: "condomino", condominioId: pessoa.condominio_id, pessoaId: pessoa.id };
}

export interface ResumoAdmin {
  condominio: { nome: string; morada: string };
  mes: Data;
  contas: ReturnType<typeof contasDoPredio>;
  mesAtual: { emitidoCent: number; pagoCent: number; fracoesPagas: number; fracoesTotal: number };
  atrasos: {
    fracaoId: string;
    identificacao: string;
    proprietarios: string[];
    emDividaCent: number;
    quotasEmAtraso: number;
    diasEmAtraso: number;
    diasParaPrazo: number;
  }[];
  despesasRecentes: { id: string; data: Data; valorCent: number; categoria: string; fornecedor: string | null; pagaPeloFundo: boolean }[];
}

export async function resumoDoAdmin(condominioId: string, hoje: Data): Promise<ResumoAdmin> {
  const supabase = await criarClienteServidor();
  const mes = primeiroDoMes(hoje);

  const [cond, fracoes, quotas, pq, despesas, props] = await Promise.all([
    supabase.from("condominios").select("nome, morada").eq("id", condominioId).single(),
    supabase.from("fracoes").select("id, identificacao").eq("condominio_id", condominioId).order("identificacao"),
    lerTodas(() => supabase.from("quotas").select("id, fracao_id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").eq("condominio_id", condominioId).order("id")),
    lerTodas(() => supabase.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", condominioId).order("pagamento_id").order("quota_id")),
    lerTodas(() => supabase.from("despesas").select("id, data, valor_cent, categoria, fornecedor, paga_pelo_fundo").eq("condominio_id", condominioId).order("data", { ascending: false }).order("id")),
    supabase.from("propriedades").select("fracao_id, pessoas(nome)").eq("condominio_id", condominioId),
  ]);
  for (const r of [cond, fracoes, quotas, pq, despesas, props]) if (r.error) throw r.error;

  const todas: (QuotaSaldo & { fracaoId: string })[] = quotas.data!.map((q) => ({
    id: q.id,
    fracaoId: q.fracao_id,
    mes: q.mes,
    valorCent: q.valor_cent,
    fundoReservaCent: q.fundo_reserva_cent,
    dataLimite: q.data_limite,
    anulada: q.estado === "anulada",
  }));
  const alocs: Alocacao[] = pq.data!.map((a) => ({ quotaId: a.quota_id, valorCent: a.valor_cent }));
  const dd = despesas.data!;

  const contas = contasDoPredio(todas, alocs, dd.map((d) => ({ valorCent: d.valor_cent, pagaPeloFundo: d.paga_pelo_fundo })));

  const doMes = todas.filter((q) => q.mes === mes);
  const idsMes = new Set(doMes.map((q) => q.id));
  const pagoMes = alocs.filter((a) => idsMes.has(a.quotaId));
  const pagoPorQuota = new Map<string, number>();
  pagoMes.forEach((a) => pagoPorQuota.set(a.quotaId, (pagoPorQuota.get(a.quotaId) ?? 0) + a.valorCent));

  const atrasos = fracoes.data!
    .map((f) => {
      const qs = todas.filter((q) => q.fracaoId === f.id);
      const ids = new Set(qs.map((q) => q.id));
      const as = alocs.filter((a) => ids.has(a.quotaId));
      const saldo = saldoDaFracao(qs, as, hoje);
      const atraso = atrasoDaFracao(qs, as, hoje);
      if (!atraso) return null;
      const donos = props.data!.filter((p) => p.fracao_id === f.id).map((p) => (p.pessoas as unknown as { nome: string } | null)?.nome).filter((n): n is string => !!n);
      return {
        fracaoId: f.id,
        identificacao: f.identificacao,
        proprietarios: donos,
        emDividaCent: saldo.emDividaCent,
        quotasEmAtraso: saldo.quotasEmAtraso,
        diasEmAtraso: atraso.diasEmAtraso,
        diasParaPrazo: atraso.diasParaPrazo,
      };
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.diasEmAtraso - a.diasEmAtraso);

  return {
    condominio: cond.data!,
    mes,
    contas,
    mesAtual: {
      emitidoCent: doMes.reduce((a, q) => a + q.valorCent, 0),
      pagoCent: pagoMes.reduce((a, p) => a + p.valorCent, 0),
      fracoesPagas: doMes.filter((q) => (pagoPorQuota.get(q.id) ?? 0) >= q.valorCent).length,
      fracoesTotal: doMes.length,
    },
    atrasos,
    despesasRecentes: dd.slice(0, 5).map((d) => ({
      id: d.id,
      data: d.data,
      valorCent: d.valor_cent,
      categoria: d.categoria,
      fornecedor: d.fornecedor,
      pagaPeloFundo: d.paga_pelo_fundo,
    })),
  };
}
