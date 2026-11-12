"use server";

import { redirect } from "next/navigation";
import { lerDefinicoes } from "@/lib/definicoes";
import { lerListaFracoes } from "@/lib/fracoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";

export async function criarCondominioAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const nomeAdmin = String(dados.get("nomeAdmin") ?? "").trim();
  if (!nomeAdmin || nomeAdmin.length > 120) return { erro: "Indique o seu nome." };

  const lido = lerDefinicoes(dados);
  if ("erro" in lido) return { erro: lido.erro };
  const lista = lerListaFracoes(String(dados.get("fracoes") ?? ""));
  if ("erro" in lista) return { erro: lista.erro };
  const d = lido.definicoes;

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("criar_condominio", {
    p_nome_admin: nomeAdmin,
    p_condominio: {
      nome: d.nome, morada: d.morada, nif: d.nif ?? "", iban: d.iban ?? "", modo_quota: d.modo,
      valor_quota_cent: d.valorCent, fundo_reserva_pct: d.fundoPct, dia_vencimento: d.dia,
    },
    p_fracoes: lista.fracoes,
  });
  if (error) {
    return { erro: error.message.includes("ja_tem_condominio") ? "Esta conta já tem um condomínio." : "Não foi possível criar o condomínio. Tente de novo." };
  }
  redirect("/");
}
