import type { Data } from "../datas";

export interface QuotaRel {
  id: string;
  mes: Data;
  valorCent: number;
  fundoReservaCent: number;
  dataLimite: Data;
}
export interface AlocacaoRel {
  quotaId: string;
  /** Data do pagamento. */
  data: Data;
  valorCent: number;
}
export interface DespesaRel {
  data: Data;
  valorCent: number;
  categoria: string;
  fornecedor: string | null;
  pagaPeloFundo: boolean;
}

export interface RelatorioContas {
  ano: number;
  receitasPorMes: number[];
  totalReceitasCent: number;
  despesasPorCategoria: { categoria: string; totalCent: number }[];
  despesas: DespesaRel[];
  totalDespesasCent: number;
  despesasFundoCent: number;
  saldoInicialCent: number;
  saldoFinalCent: number;
  fundoInicialCent: number;
  fundoRecebidoCent: number;
  fundoUsadoCent: number;
  fundoFinalCent: number;
  quotasEmitidasCent: number;
  /** Quotas vencidas até 31/12 e ainda por pagar nessa data (total do prédio, sem identificar frações). */
  quotasPorCobrarCent: number;
}

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Contas de um ano civil, a partir dos registos (quotas, pagamentos por quota e despesas). */
export function calcularRelatorio(ano: number, quotas: QuotaRel[], alocacoes: AlocacaoRel[], despesas: DespesaRel[]): RelatorioContas {
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const porQuota = new Map(quotas.map((q) => [q.id, q]));
  const fundoDe = (a: AlocacaoRel) => {
    const q = porQuota.get(a.quotaId);
    return q && q.valorCent > 0 ? Math.round((a.valorCent * q.fundoReservaCent) / q.valorCent) : 0;
  };

  const antes = alocacoes.filter((a) => a.data < inicio);
  const noAno = alocacoes.filter((a) => a.data >= inicio && a.data <= fim);
  const ateFim = alocacoes.filter((a) => a.data <= fim);

  const receitasPorMes = Array.from({ length: 12 }, (_, m) => soma(noAno.filter((a) => Number(a.data.slice(5, 7)) === m + 1).map((a) => a.valorCent)));
  const totalReceitasCent = soma(receitasPorMes);

  const despAno = despesas.filter((d) => d.data >= inicio && d.data <= fim).sort((a, b) => a.data.localeCompare(b.data));
  const despAntes = despesas.filter((d) => d.data < inicio);
  const porCat = new Map<string, number>();
  despAno.forEach((d) => porCat.set(d.categoria, (porCat.get(d.categoria) ?? 0) + d.valorCent));
  const totalDespesasCent = soma(despAno.map((d) => d.valorCent));
  const despesasFundoCent = soma(despAno.filter((d) => d.pagaPeloFundo).map((d) => d.valorCent));

  const saldoInicialCent = soma(antes.map((a) => a.valorCent)) - soma(despAntes.map((d) => d.valorCent));
  const fundoInicialCent = soma(antes.map(fundoDe)) - soma(despAntes.filter((d) => d.pagaPeloFundo).map((d) => d.valorCent));
  const fundoRecebidoCent = soma(noAno.map(fundoDe));

  const pagoAteFim = new Map<string, number>();
  ateFim.forEach((a) => pagoAteFim.set(a.quotaId, (pagoAteFim.get(a.quotaId) ?? 0) + a.valorCent));
  const quotasPorCobrarCent = soma(quotas.filter((q) => q.dataLimite <= fim).map((q) => Math.max(0, q.valorCent - (pagoAteFim.get(q.id) ?? 0))));

  return {
    ano,
    receitasPorMes,
    totalReceitasCent,
    despesasPorCategoria: [...porCat].map(([categoria, totalCent]) => ({ categoria, totalCent })).sort((a, b) => b.totalCent - a.totalCent),
    despesas: despAno,
    totalDespesasCent,
    despesasFundoCent,
    saldoInicialCent,
    saldoFinalCent: saldoInicialCent + totalReceitasCent - totalDespesasCent,
    fundoInicialCent,
    fundoRecebidoCent,
    fundoUsadoCent: despesasFundoCent,
    fundoFinalCent: fundoInicialCent + fundoRecebidoCent - despesasFundoCent,
    quotasEmitidasCent: soma(quotas.filter((q) => q.mes >= inicio && q.mes <= fim).map((q) => q.valorCent)),
    quotasPorCobrarCent,
  };
}
