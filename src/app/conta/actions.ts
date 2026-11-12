"use server";

import { redirect } from "next/navigation";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { confirmaNome } from "@/lib/confirmacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";

const BUCKETS = ["faturas", "documentos"];

/**
 * Elimina a conta de um condómino: remove o acesso e anonimiza os dados pessoais.
 * Os registos contabilísticos do condomínio (quotas, pagamentos) ficam, sem identificação da pessoa.
 */
export async function eliminarMinhaContaAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "condomino") return { erro: "Esta ação é só para condóminos." };
  if (!confirmaNome(String(dados.get("confirmacao") ?? ""), "ELIMINAR")) return { erro: "Escreva ELIMINAR para confirmar." };

  const supabase = await criarClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) return { erro: "Sessão inválida." };

  // A chave de serviço só é usada depois de confirmar quem pede e que a pessoa lhe pertence.
  const servico = criarClienteAdmin();
  const { error } = await servico
    .from("pessoas")
    .update({ nome: "Pessoa removida", email: null, telemovel: null, nif: null, auth_user_id: null })
    .eq("id", papel.pessoaId)
    .eq("auth_user_id", uid);
  if (error) return { erro: "Não foi possível eliminar a conta. Tente de novo." };

  await servico.from("lembretes").update({ email: "[removido]" }).eq("pessoa_id", papel.pessoaId);
  await servico.from("registo_atividade").insert({ condominio_id: papel.condominioId, pessoa_id: papel.pessoaId, acao: "pessoa.conta_eliminada", entidade: "pessoas", entidade_id: papel.pessoaId });
  await servico.auth.admin.deleteUser(uid);
  await supabase.auth.signOut();
  redirect("/entrar");
}

async function listarFicheiros(sb: ReturnType<typeof criarClienteAdmin>, bucket: string, prefixo: string): Promise<string[]> {
  const out: string[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await sb.storage.from(bucket).list(prefixo, { limit: 1000, offset: desde });
    if (!data || data.length === 0) break;
    out.push(...data.map((f) => `${prefixo}/${f.name}`));
    if (data.length < 1000) break;
  }
  return out;
}

/** Elimina o condomínio e TODOS os dados associados (irreversível), incluindo ficheiros e contas de acesso. */
export async function eliminarCondominioAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "administrador") return { erro: "Só o administrador pode eliminar o condomínio." };

  const supabase = await criarClienteServidor();
  const { data: cond } = await supabase.from("condominios").select("nome").eq("id", papel.condominioId).single();
  if (!cond || !confirmaNome(String(dados.get("confirmacao") ?? ""), cond.nome)) return { erro: "Escreva o nome do condomínio, exatamente, para confirmar." };

  const { data: pessoas } = await supabase.from("pessoas").select("auth_user_id").eq("condominio_id", papel.condominioId).not("auth_user_id", "is", null);
  const idsAcesso = (pessoas ?? []).map((p) => p.auth_user_id as string);

  const servico = criarClienteAdmin();
  const ficheiros = await Promise.all(BUCKETS.map(async (b) => ({ bucket: b, caminhos: await listarFicheiros(servico, b, papel.condominioId) })));

  // Apaga em cascata frações, quotas, pagamentos, despesas, documentos, lembretes, pessoas e registo de atividade.
  const { error } = await supabase.from("condominios").delete().eq("id", papel.condominioId);
  if (error) return { erro: "Não foi possível eliminar o condomínio. Nada foi apagado." };

  for (const f of ficheiros) if (f.caminhos.length > 0) await servico.storage.from(f.bucket).remove(f.caminhos);
  for (const id of idsAcesso) await servico.auth.admin.deleteUser(id);
  await supabase.auth.signOut();
  redirect("/entrar");
}
