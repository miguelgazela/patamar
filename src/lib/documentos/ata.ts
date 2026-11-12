import { dataLimite, fundoReservaDe, valoresDaQuota, type ConfigQuota } from "../quotas";
import { meses, type Data } from "../datas";

export interface DadosAta {
  condominio: { nome: string; morada: string; nif: string | null };
  config: ConfigQuota;
  fracoes: { id: string; identificacao: string; permilagem: number; proprietarios: string[] }[];
  /** Ano a que se referem as contribuições aprovadas. */
  ano: number;
}

export interface LinhaContribuicao {
  identificacao: string;
  permilagem: number;
  proprietarios: string[];
  quotaMensalCent: number;
  montanteAnualCent: number;
  fundoReservaAnualCent: number;
}

export interface ModeloAta {
  ano: number;
  linhas: LinhaContribuicao[];
  totalAnualCent: number;
  totalFundoCent: number;
  vencimentos: Data[];
}

/** Montante anual de cada condómino e datas de vencimento: o que a ata que aprova as contribuições deve indicar. */
export function montarModeloAta(d: DadosAta): ModeloAta {
  const mensal = valoresDaQuota(d.config, d.fracoes);
  const linhas: LinhaContribuicao[] = d.fracoes.map((f) => {
    const q = mensal.get(f.id)!;
    return {
      identificacao: f.identificacao,
      permilagem: f.permilagem,
      proprietarios: f.proprietarios,
      quotaMensalCent: q,
      montanteAnualCent: q * 12,
      fundoReservaAnualCent: fundoReservaDe(q, d.config.fundoReservaPct) * 12,
    };
  });
  return {
    ano: d.ano,
    linhas,
    totalAnualCent: linhas.reduce((a, l) => a + l.montanteAnualCent, 0),
    totalFundoCent: linhas.reduce((a, l) => a + l.fundoReservaAnualCent, 0),
    vencimentos: meses(`${d.ano}-01-01`, `${d.ano}-12-01`).map((m) => dataLimite(m, d.config.diaVencimento)),
  };
}
