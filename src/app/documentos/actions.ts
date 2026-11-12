"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { hojeEmLisboa } from "@/lib/datas";
import { gerarAta, gerarRelatorio } from "@/lib/documentos/gerar";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";

/** Gera o PDF e publica-o no portal dos condóminos. */
export async function publicarDocumentoAction(tipo: string, ano: number): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  if (tipo !== "relatorio" && tipo !== "ata") return { erro: "Este documento não se publica no portal." };
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { erro: "Ano inválido." };

  const pdf = tipo === "relatorio" ? await gerarRelatorio(papel.condominioId, ano) : await gerarAta(papel.condominioId, ano);
  const supabase = await criarClienteServidor();
  const caminho = `${papel.condominioId}/${randomUUID()}.pdf`;
  const { error: erroUpload } = await supabase.storage.from("documentos").upload(caminho, pdf.buffer, { contentType: "application/pdf" });
  if (erroUpload) return { erro: "Não foi possível guardar o ficheiro." };

  const { error } = await supabase.from("documentos").insert({
    condominio_id: papel.condominioId,
    tipo: tipo === "relatorio" ? "relatorio_contas" : "ata",
    titulo: pdf.titulo,
    data: hojeEmLisboa(),
    ficheiro_path: caminho,
  });
  if (error) {
    await supabase.storage.from("documentos").remove([caminho]); // sem ficheiros órfãos
    return { erro: "Não foi possível publicar o documento." };
  }
  await supabase.from("registo_atividade").insert({ condominio_id: papel.condominioId, pessoa_id: papel.pessoaId, acao: "documento.publicado", entidade: "documentos", detalhe: { titulo: pdf.titulo } });
  revalidatePath("/documentos");
  revalidatePath("/");
  return { ok: `«${pdf.titulo}» publicado no portal dos condóminos.` };
}

export async function removerDocumentoAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const id = String(dados.get("id") ?? "");
  const supabase = await criarClienteServidor();
  const { data: doc } = await supabase.from("documentos").select("ficheiro_path").eq("id", id).eq("condominio_id", papel.condominioId).maybeSingle();
  if (!doc) return { erro: "Documento não encontrado." };
  const { error } = await supabase.from("documentos").delete().eq("id", id).eq("condominio_id", papel.condominioId);
  if (error) return { erro: "Não foi possível remover o documento." };
  if (doc.ficheiro_path) await supabase.storage.from("documentos").remove([doc.ficheiro_path]);
  revalidatePath("/documentos");
  return { ok: "Documento removido." };
}
