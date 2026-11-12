"use server";

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { dataValida, hojeEmLisboa } from "@/lib/datas";
import { detetarImagem, lerFatura, MODELO_PADRAO, type TipoImagem } from "@/lib/fatura/ler";
import { construirProposta } from "@/lib/fatura/proposta";
import { CATEGORIAS, type PropostaDespesa } from "@/lib/fatura/tipos";
import { lerEuros } from "@/lib/money";
import { nifValido, normalizarNif } from "@/lib/nif";
import { criarClienteServidor } from "@/lib/supabase/server";

const TIPOS: Record<string, { tipo: TipoImagem; ext: string }> = {
  "image/jpeg": { tipo: "image/jpeg", ext: "jpg" },
  "image/png": { tipo: "image/png", ext: "png" },
  "image/webp": { tipo: "image/webp", ext: "webp" },
};
const MAX_BYTES = 6 * 1024 * 1024;

export interface EstadoLeitura {
  passo: "foto" | "confirmar";
  faturaPath?: string;
  proposta?: PropostaDespesa;
  /** Mensagem informativa (ex.: leitura automática indisponível). */
  aviso?: string;
  erro?: string;
}

async function exigirAdmin() {
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "administrador") throw new Error("Sem permissão.");
  return papel;
}

const VAZIA: PropostaDespesa = { valorCent: null, data: null, fornecedor: null, nif: null, categoria: "outro", descricao: null, avisos: [] };

/** Passo 1: guarda a fotografia e pede ao Claude para propor os dados da despesa. */
export async function lerFaturaAction(_: EstadoLeitura, dados: FormData): Promise<EstadoLeitura> {
  const papel = await exigirAdmin();
  const foto = dados.get("foto");
  if (!(foto instanceof File) || foto.size === 0) return { passo: "foto", erro: "Escolha ou tire uma fotografia da fatura." };
  if (foto.size > MAX_BYTES) return { passo: "foto", erro: "A fotografia é demasiado grande (máx. 6 MB)." };

  const bytes = Buffer.from(await foto.arrayBuffer());
  // O tipo vem dos primeiros bytes do ficheiro, não do MIME enviado pelo cliente.
  const tipoReal = detetarImagem(bytes);
  const formato = tipoReal ? TIPOS[tipoReal] : undefined;
  if (!formato) return { passo: "foto", erro: "Formato não suportado. Use uma fotografia JPEG, PNG ou WebP." };
  const supabase = await criarClienteServidor();
  const faturaPath = `${papel.condominioId}/${randomUUID()}.${formato.ext}`;
  const { error: erroUpload } = await supabase.storage.from("faturas").upload(faturaPath, bytes, { contentType: formato.tipo });
  if (erroUpload) return { passo: "foto", erro: "Não foi possível guardar a fotografia. Tente de novo." };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { passo: "confirmar", faturaPath, proposta: VAZIA, aviso: "A leitura automática não está configurada. Preencha os dados a partir da fatura." };
  }

  try {
    const { data: cond } = await supabase.from("condominios").select("nif").eq("id", papel.condominioId).single();
    const lida = await lerFatura(new Anthropic(), bytes.toString("base64"), formato.tipo, {
      nifCondominio: cond?.nif ?? null,
      modelo: process.env.ANTHROPIC_MODEL || MODELO_PADRAO,
    });
    if (!lida) return { passo: "confirmar", faturaPath, proposta: VAZIA, aviso: "Não foi possível ler a fatura. Preencha os dados a partir da fotografia." };
    return { passo: "confirmar", faturaPath, proposta: construirProposta(lida, hojeEmLisboa(), cond?.nif ?? null) };
  } catch (e) {
    console.error("Erro ao ler fatura", e instanceof Error ? e.message : e);
    return { passo: "confirmar", faturaPath, proposta: VAZIA, aviso: "A leitura automática falhou. Preencha os dados a partir da fotografia." };
  }
}

export interface EstadoGuardar {
  erro?: string;
  valores?: Record<string, string>;
}

/** Passo 2: o administrador confirma (ou corrige) e a despesa é guardada. */
export async function guardarDespesaAction(_: EstadoGuardar, dados: FormData): Promise<EstadoGuardar> {
  const papel = await exigirAdmin();
  const texto = (k: string) => String(dados.get(k) ?? "").trim();
  const valores = Object.fromEntries(["valor", "data", "fornecedor", "nif", "categoria", "descricao", "faturaPath"].map((k) => [k, texto(k)]));
  const recorrente = dados.get("recorrente") === "on";
  const pagaPeloFundo = dados.get("pagaPeloFundo") === "on";
  const falha = (erro: string): EstadoGuardar => ({ erro, valores: { ...valores, recorrente: String(recorrente), pagaPeloFundo: String(pagaPeloFundo) } });

  const valorCent = lerEuros(valores.valor);
  if (valorCent === null || valorCent <= 0) return falha("Indique um valor válido, por exemplo 38,20.");
  if (!dataValida(valores.data)) return falha("Indique a data da fatura.");
  if (valores.data > hojeEmLisboa()) return falha("A data da fatura não pode ser futura.");
  const categoria = (CATEGORIAS as readonly string[]).includes(valores.categoria) ? valores.categoria : "outro";
  const nif = normalizarNif(valores.nif);
  if (nif && !nifValido(nif)) return falha("O NIF do fornecedor não é válido.");
  if (valores.faturaPath && !new RegExp(`^${papel.condominioId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(valores.faturaPath)) return falha("Fatura inválida.");

  const supabase = await criarClienteServidor();
  const { data: despesa, error } = await supabase
    .from("despesas")
    .insert({
      condominio_id: papel.condominioId,
      data: valores.data,
      valor_cent: valorCent,
      categoria,
      fornecedor: valores.fornecedor || null,
      fornecedor_nif: nif,
      fatura_path: valores.faturaPath || null,
      recorrente,
      paga_pelo_fundo: pagaPeloFundo,
      descricao: valores.descricao || null,
    })
    .select("id")
    .single();
  if (error) return falha("Não foi possível guardar a despesa. Tente de novo.");

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId,
    pessoa_id: papel.pessoaId,
    acao: "despesa.criada",
    entidade: "despesas",
    entidade_id: despesa.id,
    detalhe: { valor_cent: valorCent, categoria, com_fatura: !!valores.faturaPath },
  });

  redirect("/");
}
