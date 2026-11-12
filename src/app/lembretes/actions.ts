"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/admin";
import { hojeEmLisboa } from "@/lib/datas";
import { enviarLembretes, type ResultadoEnvio } from "@/lib/lembretes-envio";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoForm } from "../fracoes/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function enviarLembretesAction(fracaoIds: unknown): Promise<ResultadoEnvio & { erro?: string }> {
  const papel = await exigirAdmin();
  const ids = z.array(z.string().regex(UUID)).max(100).safeParse(fracaoIds);
  if (!ids.success || ids.data.length === 0) return { enviados: 0, falhas: 0, semEmail: 0, erro: "Escolha pelo menos uma fração." };
  const supabase = await criarClienteServidor();
  const r = await enviarLembretes(supabase, papel.condominioId, hojeEmLisboa(), { modo: "manual", fracaoIds: ids.data, pessoaId: papel.pessoaId });
  revalidatePath("/lembretes");
  return r;
}

export async function guardarConfigLembretesAction(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const papel = await exigirAdmin();
  const tolerancia = Number(dados.get("tolerancia"));
  const intervalo = Number(dados.get("intervalo"));
  if (!Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 60) return { erro: "A tolerância deve estar entre 0 e 60 dias." };
  if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 90) return { erro: "O intervalo deve estar entre 1 e 90 dias." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("condominios")
    .update({ lembretes_automaticos: dados.get("automaticos") === "on", lembrete_tolerancia_dias: tolerancia, lembrete_intervalo_dias: intervalo })
    .eq("id", papel.condominioId);
  if (error) return { erro: "Não foi possível guardar." };
  revalidatePath("/lembretes");
  return { ok: "Definições guardadas." };
}
