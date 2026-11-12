import { adicionarDias, type Data } from "./datas";
import { repartir } from "./money";

export type ModoQuota = "fixa" | "permilagem";

export interface ConfigQuota {
  modo: ModoQuota;
  /** fixa: valor por fração/mês. permilagem: total mensal do prédio. */
  valorQuotaCent: number;
  /** Percentagem do fundo de reserva (0-100, até 2 casas decimais). */
  fundoReservaPct: number;
  /** Dia do mês (1-28) em que a quota vence. */
  diaVencimento: number;
}

export interface FracaoPeso {
  id: string;
  permilagem: number;
}

/** Parte da quota que vai para o fundo comum de reserva (arredondada ao cêntimo). */
export function fundoReservaDe(valorCent: number, pct: number): number {
  const pontosBase = Math.round(pct * 100); // 10 % -> 1000 de 10000
  return Math.round((valorCent * pontosBase) / 10_000);
}

/** Valor da quota mensal de cada fração. Em permilagem a soma é exatamente o total. */
export function valoresDaQuota(config: ConfigQuota, fracoes: FracaoPeso[]): Map<string, number> {
  if (config.modo === "fixa") {
    return new Map(fracoes.map((f) => [f.id, config.valorQuotaCent]));
  }
  const partes = repartir(
    config.valorQuotaCent,
    fracoes.map((f) => f.permilagem),
  );
  return new Map(fracoes.map((f, i) => [f.id, partes[i]]));
}

export function dataLimite(mes: Data, diaVencimento: number): Data {
  return adicionarDias(mes, diaVencimento - 1);
}

export interface QuotaGerada {
  fracaoId: string;
  mes: Data;
  valorCent: number;
  fundoReservaCent: number;
  dataLimite: Data;
}

/** Gera as quotas de um mês (1.º dia) para todas as frações. */
export function gerarQuotasDoMes(mes: Data, config: ConfigQuota, fracoes: FracaoPeso[]): QuotaGerada[] {
  const valores = valoresDaQuota(config, fracoes);
  return fracoes.map((f) => {
    const valorCent = valores.get(f.id)!;
    return {
      fracaoId: f.id,
      mes,
      valorCent,
      fundoReservaCent: fundoReservaDe(valorCent, config.fundoReservaPct),
      dataLimite: dataLimite(mes, config.diaVencimento),
    };
  });
}

/** Montante anual por fração (para a ata), somando os 12 meses. */
export function montanteAnual(config: ConfigQuota, fracoes: FracaoPeso[]): Map<string, number> {
  const mensal = valoresDaQuota(config, fracoes);
  return new Map([...mensal].map(([id, v]) => [id, v * 12]));
}
