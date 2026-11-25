"use server";

import { redirect } from "next/navigation";
import { VERSAO_TEXTOS_LEGAIS } from "@/lib/legal";
import { criarClienteAnonimo } from "@/lib/supabase/anonimo";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface EstadoEntrar {
  passo: "email" | "codigo";
  email: string;
  erro?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function pedirCodigo(_: EstadoEntrar, dados: FormData): Promise<EstadoEntrar> {
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { passo: "email", email, erro: "Indique um email válido." };

  const supabase = criarClienteAnonimo(); // sem PKCE: ver criarClienteAnonimo
  const criar = dados.get("criar") === "1"; // só em /comecar: cria a conta se ainda não existir
  if (criar && dados.get("aceito") !== "on") {
    return { passo: "email", email, erro: "Para criar o condomínio, aceite os Termos de utilização e a Política de privacidade." };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: criar,
      // Prova do consentimento (só tem efeito na criação da conta).
      ...(criar ? { data: { termos_versao: VERSAO_TEXTOS_LEGAIS, termos_aceites_em: new Date().toISOString() } } : {}),
    },
  });

  // Não revelar se o email existe: mesma resposta para contas desconhecidas.
  if (error && error.status === 429) {
    return { passo: "email", email, erro: "Pediu demasiados códigos. Aguarde uns minutos e tente de novo." };
  }
  return { passo: "codigo", email };
}

export async function validarCodigo(_: EstadoEntrar, dados: FormData): Promise<EstadoEntrar> {
  const email = String(dados.get("email") ?? "");
  const codigo = String(dados.get("codigo") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(codigo)) return { passo: "codigo", email, erro: "O código tem 6 dígitos." };

  const supabase = await criarClienteServidor();
  // O tipo depende de como a conta foi criada: «email» cobre o normal; «signup» e «magiclink» são alternativas
  // para contas ainda por confirmar. Experimenta por ordem e só falha se nenhum servir.
  let ultimoErro: { code?: string; status?: number; message: string } | null = null;
  for (const type of ["email", "signup", "magiclink"] as const) {
    const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type });
    if (!error) {
      ultimoErro = null;
      break;
    }
    ultimoErro = error;
    if (error.status === 429) break;
  }
  if (ultimoErro) {
    // Sem dados pessoais: só o motivo, para diagnóstico nos registos do servidor.
    console.error("verifyOtp falhou:", { code: ultimoErro.code, status: ultimoErro.status, message: ultimoErro.message });
    const demasiadas = ultimoErro.status === 429;
    return {
      passo: "codigo",
      email,
      erro: demasiadas ? "Demasiadas tentativas. Aguarde uns minutos e peça um novo código." : "Código inválido ou expirado. Peça um novo código e use o do email mais recente.",
    };
  }

  redirect("/");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
