"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { lerDefinicoes } from "@/lib/definicoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";

export async function guardarDefinicoesAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const lido = lerDefinicoes(dados);
  if ("erro" in lido) return { erro: lido.erro };
  const { nome, morada, nif, iban, modo, valorCent, fundoPct, dia } = lido.definicoes;

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("condominios")
    .update({
      nome,
      morada,
      nif,
      iban,
      modo_quota: modo,
      valor_quota_cent: valorCent,
      fundo_reserva_pct: fundoPct,
      dia_vencimento: dia,
    })
    .eq("id", papel.condominioId);
  if (error) return { erro: "Não foi possível guardar as definições." };

  await supabase.from("registo_atividade").insert({
    condominio_id: papel.condominioId,
    pessoa_id: papel.pessoaId,
    acao: "condominio.definicoes",
    entidade: "condominios",
    entidade_id: papel.condominioId,
    detalhe: { modo, valor_quota_cent: valorCent, fundo_reserva_pct: fundoPct, dia_vencimento: dia },
  });
  revalidatePath("/definicoes");
  revalidatePath("/");
  const aviso = fundoPct < 10 ? " Atenção: o fundo comum de reserva legal não pode ser inferior a 10 % das contribuições." : "";
  return { ok: `Definições guardadas. As alterações à quota aplicam-se às quotas geradas a partir de agora.${aviso}` };
}
