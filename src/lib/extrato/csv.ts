/** Descodifica o ficheiro: UTF-8 se for válido, senão Windows-1252 (o que muitos bancos portugueses exportam). */
export function decodificar(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/** Escolhe o separador (; , ou tab) mais consistente nas primeiras linhas, ignorando o que está entre aspas. */
export function detetarDelimitador(texto: string): string {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  let melhor = ";";
  let melhorPontos = -1;
  for (const d of [";", "\t", ","]) {
    const contagens = linhas.map((l) => contarFora(l, d));
    const frequente = Math.max(...contagens, 0);
    const consistentes = contagens.filter((c) => c === frequente && c > 0).length;
    const pontos = consistentes * 100 + frequente;
    if (frequente > 0 && pontos > melhorPontos) {
      melhor = d;
      melhorPontos = pontos;
    }
  }
  return melhor;
}

function contarFora(linha: string, d: string): number {
  let dentro = false;
  let n = 0;
  for (const c of linha) {
    if (c === '"') dentro = !dentro;
    else if (c === d && !dentro) n++;
  }
  return n;
}

/** Lê CSV (aspas, aspas duplas escapadas, CRLF). Linhas totalmente vazias são descartadas. */
export function lerCsv(texto: string, delimitador?: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const d = delimitador ?? detetarDelimitador(t);
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentro = false;
  const fecharLinha = () => {
    linha.push(campo);
    campo = "";
    if (linha.some((c) => c.trim() !== "")) linhas.push(linha.map((c) => c.trim()));
    linha = [];
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentro) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else dentro = false;
      } else campo += c;
    } else if (c === '"') dentro = true;
    else if (c === d) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") fecharLinha();
    else if (c !== "\r") campo += c;
  }
  if (campo !== "" || linha.length > 0) fecharLinha();
  return linhas;
}
