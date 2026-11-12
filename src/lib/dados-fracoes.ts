import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface FracaoLista {
  id: string;
  identificacao: string;
  tipo: string;
  permilagem: number;
  anexos: { id: string; tipo: string; identificacao: string }[];
  proprietarios: string[];
  /** Tem quotas ou pagamentos: não pode ser removida. */
  temHistorico: boolean;
}

export async function listarFracoes(condominioId: string): Promise<FracaoLista[]> {
  const supabase = await criarClienteServidor();
  const [fracoes, anexos, props, quotas, pagamentos] = await Promise.all([
    supabase.from("fracoes").select("id, identificacao, tipo, permilagem").eq("condominio_id", condominioId).order("identificacao"),
    supabase.from("anexos").select("id, fracao_id, tipo, identificacao").eq("condominio_id", condominioId).order("identificacao"),
    supabase.from("propriedades").select("fracao_id, pessoas(nome)").eq("condominio_id", condominioId),
    supabase.from("quotas").select("fracao_id").eq("condominio_id", condominioId),
    supabase.from("pagamentos").select("fracao_id").eq("condominio_id", condominioId),
  ]);
  for (const r of [fracoes, anexos, props, quotas, pagamentos]) if (r.error) throw r.error;
  const comHistorico = new Set([...quotas.data!, ...pagamentos.data!].map((x) => x.fracao_id as string));

  return fracoes.data!.map((f) => ({
    id: f.id,
    identificacao: f.identificacao,
    tipo: f.tipo,
    permilagem: Number(f.permilagem),
    anexos: anexos.data!.filter((a) => a.fracao_id === f.id).map((a) => ({ id: a.id, tipo: a.tipo, identificacao: a.identificacao })),
    proprietarios: props.data!
      .filter((p) => p.fracao_id === f.id)
      .map((p) => (p.pessoas as unknown as { nome: string } | null)?.nome)
      .filter((n): n is string => !!n),
    temHistorico: comHistorico.has(f.id),
  }));
}
