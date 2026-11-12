import type { Data } from "../datas";

export interface DadosDeclaracao {
  condominio: { nome: string; morada: string; nif: string | null; iban: string | null };
  administrador: { nome: string };
  fracao: { identificacao: string; tipo: string; permilagem: number; anexos: string[]; proprietarios: string[] };
  /** Valor da quota mensal em vigor para esta fração. */
  quotaMensalCent: number;
  fundoReservaPct: number;
  /** Quotas vencidas e por pagar à data de emissão. */
  quotasEmDivida: { mes: Data; restanteCent: number; dataLimite: Data }[];
  hoje: Data;
}

export interface Declaracao extends DadosDeclaracao {
  encargosAnuaisOrdinariosCent: number;
  fundoReservaAnualCent: number;
  totalEmDividaCent: number;
}

export function montarDeclaracao(d: DadosDeclaracao): Declaracao {
  const anual = d.quotaMensalCent * 12;
  return {
    ...d,
    encargosAnuaisOrdinariosCent: anual,
    fundoReservaAnualCent: Math.round((anual * d.fundoReservaPct) / 100),
    totalEmDividaCent: d.quotasEmDivida.reduce((a, q) => a + q.restanteCent, 0),
    quotasEmDivida: [...d.quotasEmDivida].sort((a, b) => a.dataLimite.localeCompare(b.dataLimite)),
  };
}
