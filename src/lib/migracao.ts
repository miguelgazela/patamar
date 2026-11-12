import { meses, somarMeses, type Data } from "./datas";

export const MAX_MESES_MIGRACAO = 60;

/** "2026-01" (input type=month) ou "2026-01-01" -> "2026-01-01". null se inválido. */
export function lerMes(texto: string): Data | null {
  const m = texto.trim().match(/^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/);
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/** Lista os meses de `de` a `ate` (inclusive), com limites que evitam gerar quotas por engano. */
export function intervaloDeMeses(de: Data, ate: Data, hoje: Data): { meses: Data[] } | { erro: string } {
  if (de > ate) return { erro: "O primeiro mês tem de ser anterior ou igual ao último." };
  if (ate > somarMeses(`${hoje.slice(0, 7)}-01`, 12)) return { erro: "Não se geram quotas com mais de 12 meses de antecedência." };
  const lista = meses(de, ate);
  if (lista.length > MAX_MESES_MIGRACAO) return { erro: `O máximo são ${MAX_MESES_MIGRACAO} meses de cada vez.` };
  return { meses: lista };
}

/** Último dia do mês de `mes` (1.º dia), limitado a `hoje` (um pagamento não pode ter data futura). */
export function dataDoSaldo(ate: Data, hoje: Data): Data {
  const fim = new Date(Date.UTC(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return fim > hoje ? hoje : fim;
}
