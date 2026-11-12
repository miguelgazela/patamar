"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { telefoneValido } from "@/lib/fracoes";
import { nifValido, normalizarNif } from "@/lib/nif";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function guardarPessoaAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const id = texto(dados, "id");
  const nome = texto(dados, "nome");
  const email = texto(dados, "email").toLowerCase();
  const telemovel = texto(dados, "telemovel");
  const nif = normalizarNif(texto(dados, "nif"));
  const fracaoIds = dados.getAll("fracoes").map(String);

  if (!nome || nome.length > 120) return { erro: "Indique o nome." };
  if (email && !EMAIL.test(email)) return { erro: "Email inválido." };
  if (telemovel && !telefoneValido(telemovel)) return { erro: "Telemóvel inválido." };
  if (nif && !nifValido(nif)) return { erro: "NIF inválido." };

  const supabase = await criarClienteServidor();
  let pessoaId = id;

  if (id) {
    const { data: atual } = await supabase.from("pessoas").select("auth_user_id, email").eq("id", id).eq("condominio_id", papel.condominioId).maybeSingle();
    if (!atual) return { erro: "Pessoa não encontrada." };
    // Com conta criada, o email é o do login e não muda aqui.
    const emailFinal = atual.auth_user_id ? atual.email : email || null;
    const { error } = await supabase
      .from("pessoas")
      .update({ nome, email: emailFinal, telemovel: telemovel || null, nif })
      .eq("id", id);
    if (error) return { erro: "Não foi possível guardar a pessoa." };
  } else {
    const { data, error } = await supabase
      .from("pessoas")
      .insert({ condominio_id: papel.condominioId, nome, email: email || null, telemovel: telemovel || null, nif })
      .select("id")
      .single();
    if (error) return { erro: "Não foi possível criar a pessoa." };
    pessoaId = data.id;
  }

  // Sincroniza as frações de que é proprietária.
  const { data: atuais } = await supabase.from("propriedades").select("fracao_id").eq("pessoa_id", pessoaId);
  const antes = new Set((atuais ?? []).map((p) => p.fracao_id as string));
  const depois = new Set(fracaoIds);
  const juntar = [...depois].filter((f) => !antes.has(f));
  const tirar = [...antes].filter((f) => !depois.has(f));
  if (juntar.length > 0) {
    const { error } = await supabase.from("propriedades").insert(juntar.map((f) => ({ pessoa_id: pessoaId, fracao_id: f, condominio_id: papel.condominioId })));
    if (error) return { erro: "Não foi possível associar as frações." };
  }
  if (tirar.length > 0) {
    const { error } = await supabase.from("propriedades").delete().eq("pessoa_id", pessoaId).in("fracao_id", tirar);
    if (error) return { erro: "Não foi possível retirar frações." };
  }

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId, pessoa_id: papel.pessoaId, acao: id ? "pessoa.editada" : "pessoa.criada",
    entidade: "pessoas", entidade_id: pessoaId, detalhe: { fracoes: fracaoIds.length },
  });
  revalidatePath("/condominos");
  revalidatePath("/fracoes");
  return { ok: id ? "Dados guardados." : "Pessoa criada." };
}

export async function removerPessoaAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const id = texto(dados, "id");
  if (id === papel.pessoaId) return { erro: "Não pode remover o seu próprio registo." };

  const supabase = await criarClienteServidor();
  const { data: p } = await supabase.from("pessoas").select("auth_user_id").eq("id", id).eq("condominio_id", papel.condominioId).maybeSingle();
  if (!p) return { erro: "Pessoa não encontrada." };
  const { count: mandatos } = await supabase.from("administracoes").select("id", { count: "exact", head: true }).eq("pessoa_id", id);
  if ((mandatos ?? 0) > 0) return { erro: "Esta pessoa tem um mandato de administração e não pode ser removida." };

  const { error } = await supabase.from("pessoas").delete().eq("id", id).eq("condominio_id", papel.condominioId);
  if (error) return { erro: "Não foi possível remover a pessoa." };
  if (p.auth_user_id) await criarClienteAdmin().auth.admin.deleteUser(p.auth_user_id); // retira o acesso

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId, pessoa_id: papel.pessoaId, acao: "pessoa.removida", entidade: "pessoas", entidade_id: id,
  });
  revalidatePath("/condominos");
  return { ok: "Pessoa removida." };
}
