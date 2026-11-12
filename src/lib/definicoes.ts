import { ibanValido, normalizarIban } from "./iban";
import { lerEuros } from "./money";
import { nifValido, normalizarNif } from "./nif";

export interface DefinicoesLidas {
  nome: string;
  morada: string;
  nif: string | null;
  iban: string | null;
  modo: "fixa" | "permilagem";
  valorCent: number;
  fundoPct: number;
  dia: number;
}

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

/** Lê e valida os campos comuns às definições e ao onboarding. */
export function lerDefinicoes(dados: FormData): { definicoes: DefinicoesLidas } | { erro: string } {
  const nome = texto(dados, "nome");
  const morada = texto(dados, "morada");
  const nif = normalizarNif(texto(dados, "nif"));
  const iban = texto(dados, "iban");
  const modo = texto(dados, "modo");
  const valorCent = lerEuros(texto(dados, "valor"));
  const pct = texto(dados, "fundo").replace(",", ".");
  const dia = Number(texto(dados, "dia"));

  if (!nome || nome.length > 120) return { erro: "Indique o nome do condomínio." };
  if (!morada || morada.length > 200) return { erro: "Indique a morada." };
  if (nif && !nifValido(nif)) return { erro: "O NIF do condomínio não é válido." };
  if (iban && !ibanValido(iban)) return { erro: "O IBAN não é válido (IBAN português, 25 caracteres)." };
  if (modo !== "fixa" && modo !== "permilagem") return { erro: "Modo de quota inválido." };
  if (valorCent === null || valorCent <= 0) return { erro: "Indique um valor de quota válido, por exemplo 45,00." };
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(pct) || Number(pct) > 100) return { erro: "O fundo de reserva deve estar entre 0 e 100 % (ex.: 10)." };
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) return { erro: "O dia de vencimento deve estar entre 1 e 28." };

  return { definicoes: { nome, morada, nif, iban: iban ? normalizarIban(iban) : null, modo, valorCent, fundoPct: Number(pct), dia } };
}
