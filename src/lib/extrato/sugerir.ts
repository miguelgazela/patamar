import { normalizarTexto, type Movimento } from "./parse";

export interface QuotaAberta {
  id: string;
  mes: string;
  /** O que falta pagar nesta quota. */
  restanteCent: number;
}

export interface FracaoInfo {
  id: string;
  identificacao: string;
  proprietarios: string[];
  /** Quotas por pagar, da mais antiga para a mais recente. */
  quotasAbertas: QuotaAberta[];
  /** Valor típico da quota mensal desta fração. */
  quotaMensalCent: number;
}

/** Pagamentos anteriores já confirmados: a descrição do extrato e a fração a que foram associados. */
export interface Historico {
  descricao: string;
  fracaoId: string;
}

export type Confianca = "alta" | "media" | "baixa" | "nenhuma";

export interface Sugestao {
  fracaoId: string | null;
  confianca: Confianca;
  motivos: string[];
  /** Todas as frações com alguma pista, da mais à menos provável. */
  alternativas: string[];
}

const dentro = (texto: string, parte: string) => parte !== "" && ` ${texto} `.includes(` ${parte} `);

function pontuar(descNorm: string, valorCent: number, f: FracaoInfo, historico: Historico[]): { pontos: number; motivos: string[] } {
  let pontos = 0;
  const motivos: string[] = [];

  // 1. Já se pagou assim antes (mesma descrição do extrato).
  if (historico.some((h) => h.fracaoId === f.id && normalizarTexto(h.descricao) === descNorm && descNorm.length >= 8)) {
    pontos += 60;
    motivos.push("Igual a um pagamento anterior desta fração");
  }

  // 2. Nome de um proprietário na descrição.
  let melhorNome = 0;
  for (const p of f.proprietarios) {
    const tokens = normalizarTexto(p).split(" ").filter((t) => t.length >= 3);
    const achados = tokens.filter((t) => dentro(descNorm, t)).length;
    if (tokens.length >= 2 && achados === tokens.length) melhorNome = Math.max(melhorNome, 50);
    else if (achados >= 2) melhorNome = Math.max(melhorNome, 40);
    else if (achados === 1) melhorNome = Math.max(melhorNome, 15);
  }
  if (melhorNome > 0) {
    pontos += melhorNome;
    motivos.push(melhorNome >= 40 ? "Nome do proprietário na descrição" : "Parte do nome do proprietário na descrição");
  }

  // 3. Identificação da fração (ex.: «1 esq») na descrição.
  const id = normalizarTexto(f.identificacao);
  if (id.length >= 3 && dentro(descNorm, id)) {
    pontos += 30;
    motivos.push(`Fração «${f.identificacao}» na descrição`);
  }

  // 4. Valor.
  const emDivida = f.quotasAbertas.reduce((a, q) => a + q.restanteCent, 0);
  let acumulado = 0;
  const somasIniciais = f.quotasAbertas.map((q) => (acumulado += q.restanteCent));
  if (emDivida > 0 && valorCent === emDivida) {
    pontos += 25;
    motivos.push("Valor igual ao que está em dívida");
  } else if (f.quotaMensalCent > 0 && valorCent === f.quotaMensalCent) {
    pontos += 20;
    motivos.push("Valor igual à quota mensal");
  } else if (somasIniciais.includes(valorCent)) {
    pontos += 20;
    motivos.push("Valor igual a várias quotas em aberto");
  } else if (f.quotaMensalCent > 0 && valorCent % f.quotaMensalCent === 0 && valorCent / f.quotaMensalCent <= 12) {
    pontos += 10;
    motivos.push("Valor múltiplo da quota mensal");
  }
  return { pontos, motivos };
}

export function sugerir(mov: Movimento, fracoes: FracaoInfo[], historico: Historico[]): Sugestao {
  const descNorm = normalizarTexto(mov.descricao);
  const pontuadas = fracoes
    .map((f) => ({ f, ...pontuar(descNorm, mov.valorCent, f, historico) }))
    .filter((p) => p.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);

  const alternativas = pontuadas.map((p) => p.f.id);
  const topo = pontuadas[0];
  if (!topo) return { fracaoId: null, confianca: "nenhuma", motivos: [], alternativas };

  const empate = pontuadas[1] && pontuadas[1].pontos === topo.pontos;
  // Só valor (ex.: todas pagam a mesma quota) e empatado: não adivinhar.
  if (empate && topo.pontos < 40) return { fracaoId: null, confianca: "nenhuma", motivos: ["Várias frações com o mesmo valor"], alternativas };
  const confianca: Confianca = topo.pontos >= 70 && !empate ? "alta" : topo.pontos >= 40 ? "media" : "baixa";
  return { fracaoId: topo.f.id, confianca, motivos: topo.motivos, alternativas };
}

export interface LinhaPrevisao {
  id: string;
  fracaoId: string | null;
  valorCent: number;
  data: string;
}

export interface Previsao {
  alocadas: { quotaId: string; mes: string; valorCent: number }[];
  /** Valor que não cabe nas quotas em aberto (não é registado). */
  sobraCent: number;
}

/** Pré-visualiza onde cada pagamento cairia, em ordem cronológica e a contar com os anteriores do mesmo ficheiro. */
export function preverAlocacoes(linhas: LinhaPrevisao[], fracoes: FracaoInfo[]): Map<string, Previsao> {
  const restante = new Map<string, number>();
  fracoes.forEach((f) => f.quotasAbertas.forEach((q) => restante.set(q.id, q.restanteCent)));
  const porId = new Map(fracoes.map((f) => [f.id, f]));
  const out = new Map<string, Previsao>();

  for (const l of [...linhas].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))) {
    const f = l.fracaoId ? porId.get(l.fracaoId) : undefined;
    if (!f) continue;
    let resto = l.valorCent;
    const alocadas: Previsao["alocadas"] = [];
    for (const q of f.quotasAbertas) {
      if (resto <= 0) break;
      const falta = restante.get(q.id) ?? 0;
      if (falta <= 0) continue;
      const v = Math.min(falta, resto);
      alocadas.push({ quotaId: q.id, mes: q.mes, valorCent: v });
      restante.set(q.id, falta - v);
      resto -= v;
    }
    out.set(l.id, { alocadas, sobraCent: resto });
  }
  return out;
}
