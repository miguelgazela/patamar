/** Permilagem em milésimas inteiras (180,5 ‰ = 180500) para somar sem erros de vírgula flutuante. */
export const TOTAL_MILESIMAS = 1_000_000;

/** "180", "180,5", "180.250" -> 180.5 / 180.25. Aceita até 3 casas decimais; devolve null se inválido. */
export function lerPermilagem(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= 1000 ? n : null;
}

export function paraMilesimas(permilagem: number): number {
  return Math.round(permilagem * 1000);
}

export interface EstadoPermilagem {
  somaPermilagem: number;
  estado: "ok" | "falta" | "excede";
  /** Diferença para 1000 ‰ (positiva se falta). */
  diferenca: number;
}

/** A soma das permilagens de um prédio em propriedade horizontal deve ser 1000 ‰. */
export function estadoPermilagem(permilagens: number[]): EstadoPermilagem {
  const soma = permilagens.reduce((a, p) => a + paraMilesimas(p), 0);
  const dif = TOTAL_MILESIMAS - soma;
  return {
    somaPermilagem: soma / 1000,
    estado: dif === 0 ? "ok" : dif > 0 ? "falta" : "excede",
    diferenca: dif / 1000,
  };
}

export const TIPOS_FRACAO = ["habitacao", "loja", "escritorio", "garagem", "outro"] as const;
export type TipoFracao = (typeof TIPOS_FRACAO)[number];
export const ROTULOS_TIPO: Record<TipoFracao, string> = {
  habitacao: "Habitação", loja: "Loja", escritorio: "Escritório", garagem: "Garagem", outro: "Outro",
};

/** Telemóvel/telefone português ou internacional, tolerante a espaços. */
export function telefoneValido(t: string): boolean {
  return /^\+?\d{9,15}$/.test(t.replace(/[\s.-]/g, ""));
}

export interface FracaoNova {
  identificacao: string;
  permilagem: number;
}

/**
 * Lê a lista colada no arranque: uma fração por linha, «Identificação; permilagem».
 * Sem permilagem em nenhuma linha, reparte 1000 ‰ em partes iguais (soma exata).
 */
export function lerListaFracoes(texto: string): { fracoes: FracaoNova[] } | { erro: string } {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 0) return { erro: "Indique pelo menos uma fração." };
  if (linhas.length > 100) return { erro: "O máximo são 100 frações." };

  const lidas = linhas.map((l) => {
    const i = l.lastIndexOf(";");
    return i === -1 ? { identificacao: l, perm: null as string | null } : { identificacao: l.slice(0, i).trim(), perm: l.slice(i + 1).trim() };
  });
  if (lidas.some((l) => !l.identificacao || l.identificacao.length > 40)) return { erro: "Cada fração precisa de uma identificação (até 40 caracteres)." };
  const chaves = lidas.map((l) => l.identificacao.toLowerCase());
  if (new Set(chaves).size !== chaves.length) return { erro: "Há identificações repetidas." };

  const comPerm = lidas.filter((l) => l.perm !== null && l.perm !== "").length;
  if (comPerm === 0) {
    const partes = repartirMilesimas(lidas.length);
    return { fracoes: lidas.map((l, i) => ({ identificacao: l.identificacao, permilagem: partes[i] / 1000 })) };
  }
  if (comPerm !== lidas.length) return { erro: "Indique a permilagem em todas as linhas ou em nenhuma (partilha em partes iguais)." };

  const fracoes: FracaoNova[] = [];
  for (const l of lidas) {
    const p = lerPermilagem(l.perm!);
    if (p === null) return { erro: `Permilagem inválida em «${l.identificacao}».` };
    fracoes.push({ identificacao: l.identificacao, permilagem: p });
  }
  return { fracoes };
}

/** 1 000 000 milésimas repartidas por n frações; a soma é sempre exata. */
function repartirMilesimas(n: number): number[] {
  const base = Math.floor(TOTAL_MILESIMAS / n);
  const resto = TOTAL_MILESIMAS - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}
