"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { hojeEmLisboa } from "@/lib/datas";
import { executarMigracao, resultadoVazio, type ResultadoMigracao } from "@/lib/migracao-envio";
import { intervaloDeMeses, lerMes } from "@/lib/migracao";
import { criarClienteServidor } from "@/lib/supabase/server";

export type { ResultadoMigracao };

export async function migrarHistoricoAction(dados: FormData): Promise<ResultadoMigracao> {
  const papel = await exigirAdmin();
  const hoje = hojeEmLisboa();
  const de = lerMes(String(dados.get("de") ?? ""));
  const ate = lerMes(String(dados.get("ate") ?? ""));
  if (!de || !ate) return resultadoVazio("Indique o primeiro e o último mês.");
  const intervalo = intervaloDeMeses(de, ate, hoje);
  if ("erro" in intervalo) return resultadoVazio(intervalo.erro);

  const valores: Record<string, string> = {};
  for (const [k, v] of dados.entries()) if (k.startsWith("valor_")) valores[k.slice(6)] = String(v);

  const supabase = await criarClienteServidor();
  const out = await executarMigracao(supabase, { condominioId: papel.condominioId, pessoaId: papel.pessoaId, hoje, de, ate, meses: intervalo.meses }, valores);
  revalidatePath("/quotas");
  revalidatePath("/");
  return out;
}
