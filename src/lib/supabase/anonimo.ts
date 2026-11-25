import { createClient } from "@supabase/supabase-js";

/**
 * Cliente sem sessão nem cookies, com fluxo «implicit». Serve para PEDIR o código por email:
 * o cliente SSR usa PKCE, que marca o token como `pkce_…` e, no Supabase hospedado, faz o código de 6 dígitos
 * ser rejeitado em verifyOtp. A verificação do código continua a usar o cliente SSR (que grava a sessão).
 */
export function criarClienteAnonimo() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
