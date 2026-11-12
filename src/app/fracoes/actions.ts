"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { lerPermilagem, TIPOS_FRACAO } from "@/lib/fracoes";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface EstadoForm {
  erro?: string;
  ok?: string;
  /** Valores submetidos, devolvidos em caso de erro para o formulário não os perder. */
  valores?: Record<string, string>;
  fracoes?: string[];
}

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

export async function guardarFracaoAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const id = texto(dados, "id");
  const identificacao = texto(dados, "identificacao");
  const tipo = texto(dados, "tipo");
  const permilagem = lerPermilagem(texto(dados, "permilagem"));

  if (!identificacao || identificacao.length > 40) return { erro: "Indique a identificação da fração (ex.: 1.º Esq.)." };
  if (!(TIPOS_FRACAO as readonly string[]).includes(tipo)) return { erro: "Tipo de fração inválido." };
  if (permilagem === null) return { erro: "A permilagem deve estar entre 0,001 e 1000 (ex.: 180 ou 180,5)." };

  const supabase = await criarClienteServidor();
  const campos = { identificacao, tipo, permilagem };
  const { error } = id
    ? await supabase.from("fracoes").update(campos).eq("id", id).eq("condominio_id", papel.condominioId)
    : await supabase.from("fracoes").insert({ ...campos, condominio_id: papel.condominioId });
  if (error) return { erro: error.code === "23505" ? "Já existe uma fração com esta identificação." : "Não foi possível guardar a fração." };

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId,
    pessoa_id: papel.pessoaId,
    acao: id ? "fracao.editada" : "fracao.criada",
    entidade: "fracoes",
    entidade_id: id || null,
    detalhe: { identificacao, tipo, permilagem },
  });
  revalidatePath("/fracoes");
  return { ok: id ? "Fração guardada." : "Fração criada." };
}

export async function removerFracaoAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const id = texto(dados, "id");
  const supabase = await criarClienteServidor();

  // Apagar uma fração apagaria em cascata as suas quotas: só se não houver histórico.
  const [quotas, pagamentos] = await Promise.all([
    supabase.from("quotas").select("id", { count: "exact", head: true }).eq("fracao_id", id),
    supabase.from("pagamentos").select("id", { count: "exact", head: true }).eq("fracao_id", id),
  ]);
  if ((quotas.count ?? 0) > 0 || (pagamentos.count ?? 0) > 0) {
    return { erro: "Esta fração tem quotas ou pagamentos registados e não pode ser removida." };
  }
  const { error } = await supabase.from("fracoes").delete().eq("id", id).eq("condominio_id", papel.condominioId);
  if (error) return { erro: "Não foi possível remover a fração." };

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId, pessoa_id: papel.pessoaId, acao: "fracao.removida", entidade: "fracoes", entidade_id: id,
  });
  revalidatePath("/fracoes");
  return { ok: "Fração removida." };
}

export async function adicionarAnexoAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const fracaoId = texto(dados, "fracaoId");
  const tipo = texto(dados, "tipo");
  const identificacao = texto(dados, "identificacao");
  if (!["box", "arrecadacao"].includes(tipo)) return { erro: "Tipo de anexo inválido." };
  if (!identificacao || identificacao.length > 40) return { erro: "Indique a identificação (ex.: Box 3)." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("anexos").insert({ condominio_id: papel.condominioId, fracao_id: fracaoId, tipo, identificacao });
  if (error) return { erro: "Não foi possível adicionar o anexo." };
  revalidatePath("/fracoes");
  return { ok: "Anexo adicionado." };
}

export async function removerAnexoAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("anexos").delete().eq("id", texto(dados, "id")).eq("condominio_id", papel.condominioId);
  if (error) return { erro: "Não foi possível remover o anexo." };
  revalidatePath("/fracoes");
  return { ok: "Anexo removido." };
}
