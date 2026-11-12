import { dataValida } from "@/lib/datas";
import { nifValido, normalizarNif } from "@/lib/nif";
import type { FaturaLida, PropostaDespesa } from "./tipos";

/** Converte o que o modelo leu numa proposta, marcando o que parece errado. Nunca confia cegamente. */
export function construirProposta(lida: FaturaLida, hoje: string, nifCondominio?: string | null): PropostaDespesa {
  const avisos: PropostaDespesa["avisos"] = [];

  let valorCent = lida.total_cent;
  if (valorCent !== null && valorCent <= 0) valorCent = null;
  if (valorCent === null) avisos.push({ campo: "valor", mensagem: "Não foi possível ler o valor total." });

  let data = lida.data_emissao && /^\d{4}-\d{2}-\d{2}$/.test(lida.data_emissao) ? lida.data_emissao : null;
  if (data && (!dataValida(data) || data > hoje)) {
    avisos.push({ campo: "data", mensagem: data > hoje ? "A data lida é futura." : "Data inválida." });
    data = null;
  } else if (!data) {
    avisos.push({ campo: "data", mensagem: "Não foi possível ler a data." });
  }

  const fornecedor = lida.fornecedor?.trim() || null;
  if (!fornecedor) avisos.push({ campo: "fornecedor", mensagem: "Não foi possível ler o fornecedor." });

  let nif = normalizarNif(lida.nif_fornecedor);
  if (nif && nifCondominio && nif === nifCondominio) {
    avisos.push({ campo: "nif", mensagem: "O NIF lido é o do condomínio, não o do fornecedor." });
    nif = null;
  } else if (nif && !nifValido(nif)) {
    avisos.push({ campo: "nif", mensagem: "O NIF lido não é válido. Confirme na fatura." });
  } else if (!nif) {
    avisos.push({ campo: "nif", mensagem: "Não foi possível ler o NIF do fornecedor." });
  }

  return {
    valorCent,
    data,
    fornecedor,
    nif,
    categoria: lida.categoria,
    descricao: lida.descricao?.trim().slice(0, 80) || null,
    avisos,
  };
}
