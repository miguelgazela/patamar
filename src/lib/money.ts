/** Valores monetários são sempre cêntimos inteiros. */

const NBSP = " ";

/** 123456 -> "1 234,56 €" (espaços não separáveis). */
export function formatarEuros(cent: number): string {
  if (!Number.isSafeInteger(cent)) throw new RangeError(`Valor em cêntimos inválido: ${cent}`);
  const sinal = cent < 0 ? "-" : "";
  const abs = Math.abs(cent);
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const cents = (abs % 100).toString().padStart(2, "0");
  return `${sinal}${euros},${cents}${NBSP}€`;
}

/** "1 234,56", "1234,5", "1.234,56 €" -> 123456. Devolve null se inválido. */
export function lerEuros(texto: string): number | null {
  const t = texto.replace(/[€\s ]/g, "");
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) return null;
  const negativo = t.startsWith("-");
  const [inteira, dec = ""] = t.replace("-", "").replace(/\./g, "").split(",");
  const cent = Number(inteira) * 100 + Number(dec.padEnd(2, "0"));
  return negativo ? -cent : cent;
}

/**
 * Reparte `total` cêntimos por pesos, pelo método do maior resto, de forma
 * a que a soma seja exatamente `total`. Empates desfeitos pela ordem de entrada.
 */
export function repartir(total: number, pesos: number[]): number[] {
  if (!Number.isInteger(total) || total < 0) throw new RangeError("Total inválido");
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (pesos.length === 0) return [];
  if (soma <= 0) throw new RangeError("A soma dos pesos tem de ser positiva");
  const partes = pesos.map((p, i) => {
    const exato = (total * p) / soma;
    return { i, base: Math.floor(exato), resto: exato - Math.floor(exato) };
  });
  let faltam = total - partes.reduce((a, p) => a + p.base, 0);
  [...partes]
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
    .forEach((p) => {
      if (faltam > 0) {
        p.base += 1;
        faltam -= 1;
      }
    });
  return partes.map((p) => p.base);
}
