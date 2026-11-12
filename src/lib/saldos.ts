import { diasEntre, adicionarDias, type Data } from "./datas";

export interface QuotaSaldo {
  id: string;
  mes: Data;
  valorCent: number;
  fundoReservaCent: number;
  dataLimite: Data;
  anulada?: boolean;
}

export interface Alocacao {
  quotaId: string;
  valorCent: number;
}

/** Valor já pago de cada quota, a partir das alocações. */
export function pagoPorQuota(alocacoes: Alocacao[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of alocacoes) m.set(a.quotaId, (m.get(a.quotaId) ?? 0) + a.valorCent);
  return m;
}

export function estadoDaQuota(q: QuotaSaldo, pagoCent: number): "pendente" | "parcial" | "paga" | "anulada" {
  if (q.anulada) return "anulada";
  if (pagoCent >= q.valorCent) return "paga";
  return pagoCent > 0 ? "parcial" : "pendente";
}

/**
 * Sugere como distribuir um pagamento: primeiro as quotas mais antigas em aberto.
 * O que sobra fica como crédito (não aloca a quotas futuras inexistentes).
 */
export function alocarPagamento(
  valorCent: number,
  quotas: QuotaSaldo[],
  jaPago: Map<string, number> = new Map(),
): { alocacoes: Alocacao[]; creditoCent: number } {
  let resto = valorCent;
  const alocacoes: Alocacao[] = [];
  const abertas = quotas.filter((q) => !q.anulada).sort((a, b) => a.mes.localeCompare(b.mes));
  for (const q of abertas) {
    if (resto <= 0) break;
    const emFalta = q.valorCent - (jaPago.get(q.id) ?? 0);
    if (emFalta <= 0) continue;
    const v = Math.min(emFalta, resto);
    alocacoes.push({ quotaId: q.id, valorCent: v });
    resto -= v;
  }
  return { alocacoes, creditoCent: resto };
}

export interface SaldoFracao {
  emitidoCent: number;
  pagoCent: number;
  /** Valor em dívida, só de quotas já vencidas (data-limite anterior a hoje). */
  emDividaCent: number;
  quotasEmAtraso: number;
}

export function saldoDaFracao(quotas: QuotaSaldo[], alocacoes: Alocacao[], hoje: Data): SaldoFracao {
  const pago = pagoPorQuota(alocacoes);
  let emitidoCent = 0;
  let pagoCent = 0;
  let emDividaCent = 0;
  let quotasEmAtraso = 0;
  for (const q of quotas) {
    if (q.anulada) continue;
    const p = Math.min(pago.get(q.id) ?? 0, q.valorCent);
    emitidoCent += q.valorCent;
    pagoCent += p;
    if (q.dataLimite < hoje && p < q.valorCent) {
      emDividaCent += q.valorCent - p;
      quotasEmAtraso += 1;
    }
  }
  return { emitidoCent, pagoCent, emDividaCent, quotasEmAtraso };
}

export const PRAZO_COBRANCA_DIAS = 90;

export interface AtrasoFracao {
  /** Data-limite da quota vencida mais antiga ainda por pagar. */
  primeiroIncumprimento: Data;
  /** Dias desde essa data-limite até hoje. */
  diasEmAtraso: number;
  /** Data até à qual a cobrança judicial deve avançar (Lei n.º 8/2022). */
  prazoCobranca: Data;
  /** Dias que faltam para o prazo (negativo se já passou). */
  diasParaPrazo: number;
}

/** null se não houver quotas vencidas por pagar. */
export function atrasoDaFracao(quotas: QuotaSaldo[], alocacoes: Alocacao[], hoje: Data): AtrasoFracao | null {
  const pago = pagoPorQuota(alocacoes);
  const vencidas = quotas
    .filter((q) => !q.anulada && q.dataLimite < hoje && (pago.get(q.id) ?? 0) < q.valorCent)
    .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite));
  if (vencidas.length === 0) return null;
  const primeiro = vencidas[0].dataLimite;
  const prazo = adicionarDias(primeiro, PRAZO_COBRANCA_DIAS);
  return {
    primeiroIncumprimento: primeiro,
    diasEmAtraso: diasEntre(primeiro, hoje),
    prazoCobranca: prazo,
    diasParaPrazo: diasEntre(hoje, prazo),
  };
}

export interface DespesaConta {
  valorCent: number;
  pagaPeloFundo: boolean;
}

export interface ContasPredio {
  emitidoCent: number;
  recebidoCent: number;
  despesasCent: number;
  /** Fundo de reserva acumulado: parte do recebido menos despesas pagas pelo fundo. */
  fundoReservaCent: number;
  /** Saldo total (inclui o fundo de reserva). */
  saldoCent: number;
  /** Saldo disponível para despesas correntes (saldo menos fundo). */
  saldoCorrenteCent: number;
}

/** Espelha a função SQL `contas_do_predio()`. */
export function contasDoPredio(quotas: QuotaSaldo[], alocacoes: Alocacao[], despesas: DespesaConta[]): ContasPredio {
  const porId = new Map(quotas.map((q) => [q.id, q]));
  const emitidoCent = quotas.filter((q) => !q.anulada).reduce((a, q) => a + q.valorCent, 0);
  let recebidoCent = 0;
  let fundoRecebido = 0;
  for (const a of alocacoes) {
    const q = porId.get(a.quotaId);
    recebidoCent += a.valorCent;
    if (q && q.valorCent > 0) fundoRecebido += Math.round((a.valorCent * q.fundoReservaCent) / q.valorCent);
  }
  const doFundo = despesas.filter((d) => d.pagaPeloFundo).reduce((a, d) => a + d.valorCent, 0);
  const despesasCent = despesas.reduce((a, d) => a + d.valorCent, 0);
  const fundoReservaCent = fundoRecebido - doFundo;
  const saldoCent = recebidoCent - despesasCent;
  return { emitidoCent, recebidoCent, despesasCent, fundoReservaCent, saldoCent, saldoCorrenteCent: saldoCent - fundoReservaCent };
}
