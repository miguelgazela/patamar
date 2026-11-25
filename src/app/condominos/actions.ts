"use server";

import { revalidatePath } from "next/cache";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { enviarEmail, escaparHtml } from "@/lib/email";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";

export type EstadoConvite = EstadoForm;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function convidarAction(_: EstadoConvite, dados: FormData): Promise<EstadoConvite> {
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "administrador") throw new Error("Sem permissão.");

  const pessoaId = String(dados.get("pessoaId") ?? "");
  const emailForm = String(dados.get("email") ?? "").trim().toLowerCase();

  // A RLS garante que só se vê pessoas do próprio condomínio.
  const supabase = await criarClienteServidor();
  const [pessoa, cond, admin] = await Promise.all([
    supabase.from("pessoas").select("id, nome, email, auth_user_id").eq("id", pessoaId).eq("condominio_id", papel.condominioId).maybeSingle(),
    supabase.from("condominios").select("nome").eq("id", papel.condominioId).single(),
    supabase.from("pessoas").select("nome").eq("id", papel.pessoaId).single(),
  ]);
  if (!pessoa.data || cond.error || admin.error) return { erro: "Pessoa não encontrada." };

  // Se já tem conta, o email não se altera: reenvia-se o convite para o mesmo endereço.
  const email = pessoa.data.auth_user_id ? (pessoa.data.email ?? "") : emailForm;
  if (!EMAIL.test(email)) return { erro: "Indique um email válido." };

  // Limite diário de convites por condomínio (proteção contra abuso do remetente oficial).
  const desdeHoje = `${hojeEmLisboa()}T00:00:00`;
  const { count: convitesHoje } = await supabase.from("registo_atividade").select("id", { count: "exact", head: true }).eq("condominio_id", papel.condominioId).eq("acao", "condomino.convidado").gte("criado_em", desdeHoje);
  if ((convitesHoje ?? 0) >= 40) return { erro: "Atingiu o limite diário de convites. Tente amanhã." };

  if (!pessoa.data.auth_user_id) {
    const servico = criarClienteAdmin();
    const { data: criado, error } = await servico.auth.admin.createUser({ email, email_confirm: true });
    if (error || !criado.user) {
      const existe = error?.code === "email_exists";
      return { erro: existe ? "Este email já tem acesso associado a outra pessoa." : "Não foi possível criar o acesso." };
    }
    const { error: erroLigar } = await supabase
      .from("pessoas")
      .update({ auth_user_id: criado.user.id, email })
      .eq("id", pessoaId);
    if (erroLigar) {
      await servico.auth.admin.deleteUser(criado.user.id); // não deixar contas órfãs
      return { erro: "Não foi possível associar o acesso à pessoa." };
    }
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/entrar`;
  const nome = escaparHtml(pessoa.data.nome.split(" ")[0]);
  const quem = escaparHtml(admin.data.nome);
  const condominio = escaparHtml(cond.data.nome);
  try {
    await enviarEmail({
      para: email,
      assunto: `Acesso ao Patamar · ${cond.data.nome}`,
      texto: `Olá ${pessoa.data.nome.split(" ")[0]},\n\n${admin.data.nome}, administrador(a) do ${cond.data.nome}, deu-lhe acesso ao Patamar, onde pode ver o seu saldo, as quotas e as contas do prédio.\n\nPara entrar, abra ${url}, escreva este email e receberá um código. Não precisa de palavra-passe.\n`,
      html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1B2433;background:#FAF7F2">
<h2 style="font-family:Georgia,serif;color:#1D4E89;margin:0 0 16px">Patamar</h2>
<p>Olá ${nome},</p>
<p>${quem}, administrador(a) do ${condominio}, deu-lhe acesso ao Patamar, onde pode ver o seu saldo, as quotas e as contas do prédio.</p>
<p>Para entrar, abra <a href="${url}" style="color:#1D4E89">${url}</a>, escreva este email e receberá um código. Não precisa de palavra-passe.</p></div>`,
    });
  } catch (e) {
    console.error("Erro ao enviar convite", e instanceof Error ? e.message : e);
    revalidatePath("/condominos");
    return { erro: "O acesso foi criado, mas o email não foi enviado. Use «Reenviar convite»." };
  }

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId,
    pessoa_id: papel.pessoaId,
    acao: "condomino.convidado",
    entidade: "pessoas",
    entidade_id: pessoaId,
  });
  revalidatePath("/condominos");
  return { ok: "Convite enviado." };
}
