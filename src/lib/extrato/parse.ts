import { lerCsv } from "./csv";

export { lerCsv };

/** "31/10/2026", "31-10-26", "2026-10-31 14:00" -> "2026-10-31". null se não for uma data válida. */
export function lerData(texto: string): string | null {
  const t = texto.trim();
  let a: number, m: number, d: number;
  let r = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\D.*)?$/);
  if (r) {
    d = Number(r[1]);
    m = Number(r[2]);
    a = r[3].length === 2 ? 2000 + Number(r[3]) : Number(r[3]);
  } else if ((r = t.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:\D.*)?$/))) {
    a = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "1.234,56", "1 234,56 €", "1,234.56", "-45,00", "45,00-", "(45,00)" -> cêntimos inteiros. null se inválido. */
export function lerValor(texto: string): number | null {
  let t = texto.replace(/[€\s ]|EUR/gi, "");
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (t.endsWith("-")) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (t.startsWith("-")) {
    negativo = true;
    t = t.slice(1);
  } else if (t.startsWith("+")) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t)) return null;

  const virgulas = (t.match(/,/g) ?? []).length;
  const pontos = (t.match(/\./g) ?? []).length;
  const ultimaVirgula = t.lastIndexOf(",");
  const ultimoPonto = t.lastIndexOf(".");
  let inteira: string;
  let decimal = "";
  const agrupado = (x: string, sep: string) => new RegExp(`^\\d{1,3}(\\${sep}\\d{3})*$`).test(x);

  if (virgulas > 0 && pontos > 0) {
    // O último símbolo é o decimal; o outro agrupa milhares.
    const [dec, mil] = ultimaVirgula > ultimoPonto ? [",", "."] : [".", ","];
    const i = t.lastIndexOf(dec);
    inteira = t.slice(0, i);
    decimal = t.slice(i + 1);
    if (inteira.includes(dec) || !agrupado(inteira, mil)) return null;
    inteira = inteira.split(mil).join("");
  } else if (virgulas > 0) {
    if (virgulas !== 1) return null;
    inteira = t.slice(0, ultimaVirgula);
    decimal = t.slice(ultimaVirgula + 1);
  } else if (pontos > 0) {
    if (pontos === 1 && t.length - ultimoPonto - 1 <= 2) {
      inteira = t.slice(0, ultimoPonto);
      decimal = t.slice(ultimoPonto + 1);
    } else if (agrupado(t, ".")) inteira = t.split(".").join("");
    else return null;
  } else inteira = t;
  if (!/^\d+$/.test(inteira) || !/^\d{0,2}$/.test(decimal)) return null;
  const cent = Number(inteira) * 100 + Number(decimal.padEnd(2, "0"));
  return negativo ? -cent : cent;
}

export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mapeamento por NOME de coluna (sobrevive a ficheiros com colunas noutra ordem). */
export interface Mapeamento {
  data: string;
  descricao: string;
  modo: "valor" | "credito_debito";
  valor?: string;
  credito?: string;
  debito?: string;
}

/** Linha do cabeçalho: a primeira com ≥3 células, a maioria não numéricas, seguida de uma linha de dados. */
export function detetarCabecalho(linhas: string[][]): number {
  for (let i = 0; i < linhas.length - 1; i++) {
    const cheias = linhas[i].filter((c) => c !== "");
    if (cheias.length < 3) continue;
    const textuais = cheias.filter((c) => lerData(c) === null && lerValor(c) === null);
    if (textuais.length / cheias.length >= 0.6) return i;
  }
  return 0;
}

/** Adivinha as colunas a partir dos nomes habituais nos extratos portugueses. */
export function mapeamentoAuto(cabecalho: string[]): Mapeamento | null {
  const norm = cabecalho.map(normalizarTexto);
  const achar = (...res: RegExp[]) => {
    for (const re of res) {
      const i = norm.findIndex((n) => re.test(n));
      if (i !== -1) return cabecalho[i];
    }
    return undefined;
  };
  const data = achar(/^data (mov|operacao|lancamento|contabil)/, /^data mov/, /^data$/, /^data/, /^date/);
  const descricao = achar(/descri/, /movimento/, /detalhe/, /observ/, /ordenante/, /narrativ/, /referencia/);
  if (!data || !descricao) return null;
  const credito = achar(/^credito/, /^entrada/, /^creditos/);
  const debito = achar(/^debito/, /^saida/, /^debitos/);
  const valor = achar(/^(valor|montante|amount)$/, /^(valor|montante)/);
  if (credito && debito) return { data, descricao, modo: "credito_debito", credito, debito };
  if (valor) return { data, descricao, modo: "valor", valor };
  if (credito) return { data, descricao, modo: "credito_debito", credito, debito: debito ?? "" };
  return null;
}

export interface Movimento {
  data: string;
  valorCent: number;
  descricao: string;
  /** Identifica o movimento para não o importar duas vezes: data|valor|descrição|n.º de ocorrência no ficheiro. */
  chave: string;
}

export interface ResultadoLeitura {
  movimentos: Movimento[];
  /** Linhas sem data/valor legíveis. */
  invalidas: number;
  /** Débitos e valores a zero (não são pagamentos de quotas). */
  semEntrada: number;
}

/** Converte as linhas de dados em entradas de dinheiro (créditos). */
export function lerMovimentos(linhas: string[][], idxCabecalho: number, m: Mapeamento): ResultadoLeitura {
  const cab = linhas[idxCabecalho] ?? [];
  const col = (nome?: string) => (nome ? cab.indexOf(nome) : -1);
  const iData = col(m.data);
  const iDesc = col(m.descricao);
  const iValor = col(m.valor);
  const iCred = col(m.credito);
  const iDeb = col(m.debito);

  const vistos = new Map<string, number>();
  const movimentos: Movimento[] = [];
  let invalidas = 0;
  let semEntrada = 0;

  for (const l of linhas.slice(idxCabecalho + 1)) {
    const data = iData >= 0 ? lerData(l[iData] ?? "") : null;
    let valor: number | null = null;
    if (m.modo === "valor") valor = iValor >= 0 ? lerValor(l[iValor] ?? "") : null;
    else {
      const c = iCred >= 0 && (l[iCred] ?? "") !== "" ? lerValor(l[iCred]) : null;
      const d = iDeb >= 0 && (l[iDeb] ?? "") !== "" ? lerValor(l[iDeb]) : null;
      valor = c !== null && c !== 0 ? Math.abs(c) : d !== null ? -Math.abs(d) : c;
    }
    if (!data || valor === null) {
      invalidas++;
      continue;
    }
    if (valor <= 0) {
      semEntrada++;
      continue;
    }
    const descricao = (iDesc >= 0 ? l[iDesc] ?? "" : "").replace(/\s+/g, " ").trim();
    const base = `${data}|${valor}|${normalizarTexto(descricao)}`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    movimentos.push({ data, valorCent: valor, descricao, chave: `${base}|${n}` });
  }
  return { movimentos, invalidas, semEntrada };
}
