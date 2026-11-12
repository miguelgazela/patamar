/** Datas de calendário como "AAAA-MM-DD" (sem fuso). Apresentação: dd/mm/aaaa. */
export type Data = string;

const MS_DIA = 86_400_000;

function utc(d: Data): number {
  const [a, m, dia] = d.split("-").map(Number);
  return Date.UTC(a, m - 1, dia);
}

export function adicionarDias(d: Data, dias: number): Data {
  return new Date(utc(d) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Dias de `a` até `b` (positivo se b é depois de a). */
export function diasEntre(a: Data, b: Data): number {
  return Math.round((utc(b) - utc(a)) / MS_DIA);
}

export function formatarData(d: Data): string {
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

/** Primeiro dia do mês de `d`. */
export function primeiroDoMes(d: Data): Data {
  return `${d.slice(0, 7)}-01`;
}

/** Os meses (1.º dia) de `de` a `ate`, inclusive. */
export function meses(de: Data, ate: Data): Data[] {
  const out: Data[] = [];
  let [a, m] = de.split("-").map(Number);
  const [fa, fm] = ate.split("-").map(Number);
  while (a < fa || (a === fa && m <= fm)) {
    out.push(`${a}-${String(m).padStart(2, "0")}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return out;
}

/** Data de hoje em Europe/Lisbon. */
export function hojeEmLisboa(agora: Date = new Date()): Data {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(agora);
}

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11-01" -> "novembro de 2026". */
export function nomeDoMes(mes: Data): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMES_MES[m - 1]} de ${a}`;
}

/** Soma (ou subtrai) meses a um mês (1.º dia). */
export function somarMeses(mes: Data, n: number): Data {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** "AAAA-MM-DD" que existe no calendário (rejeita 2026-02-31, que o Date.parse aceita como 3 de março). */
export function dataValida(d: string): boolean {
  const r = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!r) return false;
  const dt = new Date(Date.UTC(Number(r[1]), Number(r[2]) - 1, Number(r[3])));
  return dt.getUTCFullYear() === Number(r[1]) && dt.getUTCMonth() === Number(r[2]) - 1 && dt.getUTCDate() === Number(r[3]);
}
