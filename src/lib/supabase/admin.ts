import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com a chave de serviço: ignora a RLS. Usar só depois de verificar que quem pede é administrador. */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definida.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
