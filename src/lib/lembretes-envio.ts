import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmail } from "@/lib/email";
import type { Data } from "@/lib/datas";
import { calcularLembretes, montarLembrete, type CandidatoLembrete, type ConfigLembretes, type FracaoParaLembrete } from "@/lib/lembretes";
import { pagoPorQuota } from "@/lib/saldos";
import { lerTodas } from "@/lib/supabase/todas";

export interface ContextoLembretes {
  condominio: { nome: string; morada: string; nif: string | null; iban: string | null; automaticos: boolean };
  config: ConfigLembretes;
  administrador: { nome: string; email: string | null };
  fracoes: FracaoParaLembrete[];
}

/** Lê o que é preciso para calcular os lembretes. Funciona com o cliente do administrador (RLS) ou o de serviço (cron). */
export async function carregarContexto(sb: SupabaseClient, condominioId: string, hoje: Data): Promise<ContextoLembretes | null> {
  const [cond, fracoes, quotas, pq, props, lembretes, adm] = await Promise.all([
    sb.from("condominios").select("nome, morada, nif, iban, lembretes_automaticos, lembrete_tolerancia_dias, lembrete_intervalo_dias").eq("id", condominioId).single(),
    sb.from("fracoes").select("id, identificacao").eq("condominio_id", condominioId),
    lerTodas(() => sb.from("quotas").select("id, fracao_id, mes, valor_cent, data_limite, estado").eq("condominio_id", condominioId).lt("data_limite", hoje).order("id")),
    lerTodas(() => sb.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", condominioId).order("pagamento_id").order("quota_id")),
    sb.from("propriedades").select("fracao_id, pessoas(id, nome, email)").eq("condominio_id", condominioId),
    sb.from("lembretes").select("fracao_id, data").eq("condominio_id", condominioId).eq("estado", "enviado").order("data", { ascending: false }),
    sb.from("administracoes").select("pessoas(nome, email)").eq("condominio_id", condominioId).lte("inicio", hoje).or(`fim.is.null,fim.gte.${hoje}`).limit(1),
  ]);
  for (const r of [cond, fracoes, quotas, pq, props, lembretes, adm]) if (r.error) throw r.error;
  if (!cond.data) return null;

  const pago = pagoPorQuota(pq.data!.map((a) => ({ quotaId: a.quota_id, valorCent: a.valor_cent })));
  const ultimo = new Map<string, Data>();
  for (const l of lembretes.data!) if (!ultimo.has(l.fracao_id)) ultimo.set(l.fracao_id, l.data);
  const admin = (adm.data?.[0]?.pessoas as unknown as { nome: string; email: string | null } | undefined) ?? { nome: "A administração", email: null };

  return {
    condominio: { nome: cond.data.nome, morada: cond.data.morada, nif: cond.data.nif, iban: cond.data.iban, automaticos: cond.data.lembretes_automaticos },
    config: { toleranciaDias: cond.data.lembrete_tolerancia_dias, intervaloDias: cond.data.lembrete_intervalo_dias },
    administrador: admin,
    fracoes: fracoes.data!.map((f) => ({
      id: f.id,
      identificacao: f.identificacao,
      proprietarios: props
        .data!.filter((p) => p.fracao_id === f.id)
        .map((p) => p.pessoas as unknown as { id: string; nome: string; email: string | null } | null)
        .filter((p): p is { id: string; nome: string; email: string | null } => !!p),
      quotasVencidas: quotas
        .data!.filter((q) => q.fracao_id === f.id && q.estado !== "anulada")
        .map((q) => ({ mes: q.mes as string, valorCent: q.valor_cent as number, dataLimite: q.data_limite as string, restanteCent: (q.valor_cent as number) - (pago.get(q.id) ?? 0) }))
        .filter((q) => q.restanteCent > 0),
      ultimoLembrete: ultimo.get(f.id) ?? null,
    })),
  };
}

export interface ResultadoEnvio {
  enviados: number;
  falhas: number;
  semEmail: number;
  /** Atingiu o limite diário de emails do condomínio (proteção contra abuso). */
  limiteAtingido?: boolean;
}

/** Máximo de lembretes por condomínio e por dia. */
export const LIMITE_LEMBRETES_DIA = 60;

/**
 * Envia os lembretes.
 * - automático: só as frações elegíveis (tolerância e intervalo cumpridos);
 * - manual: as frações escolhidas pelo administrador, mesmo que dentro do intervalo.
 * O cálculo é sempre refeito aqui; a lista vinda do browser só diz quais frações escolher.
 */
export async function enviarLembretes(
  sb: SupabaseClient,
  condominioId: string,
  hoje: Data,
  opcoes: { modo: "manual" | "automatico"; fracaoIds?: string[]; pessoaId?: string | null },
): Promise<ResultadoEnvio> {
  const ctx = await carregarContexto(sb, condominioId, hoje);
  const out: ResultadoEnvio = { enviados: 0, falhas: 0, semEmail: 0 };
  if (!ctx) return out;

  const { count: jaEnviadosHoje } = await sb.from("lembretes").select("id", { count: "exact", head: true }).eq("condominio_id", condominioId).eq("data", hoje).eq("estado", "enviado");
  const restantes = Math.max(0, LIMITE_LEMBRETES_DIA - (jaEnviadosHoje ?? 0));
  const todos = calcularLembretes(ctx.fracoes, ctx.config, hoje);
  const escolhidos: CandidatoLembrete[] =
    opcoes.modo === "automatico" ? todos.filter((c) => c.elegivel) : todos.filter((c) => opcoes.fracaoIds?.includes(c.fracaoId));

  for (const c of escolhidos) {
    if (c.destinatarios.length === 0) {
      out.semEmail++;
      continue;
    }
    for (const d of c.destinatarios) {
      if (out.enviados >= restantes) {
        out.limiteAtingido = true;
        break;
      }
      // Regista ANTES de enviar: o índice único (fração, pessoa, dia) impede duplicados quando duas execuções correm em paralelo.
      const { data: linha, error: erroRegisto } = await sb
        .from("lembretes")
        .insert({
          condominio_id: condominioId,
          fracao_id: c.fracaoId,
          pessoa_id: d.id,
          email: d.email,
          data: hoje,
          dias_desde_primeiro_incumprimento: c.diasDesdePrimeiroIncumprimento,
          divida_cent: c.totalCent,
          quotas_em_atraso: c.quotas.length,
          modo: opcoes.modo,
          estado: "enviado",
        })
        .select("id")
        .single();
      if (erroRegisto) {
        if (erroRegisto.code !== "23505") out.falhas++; // 23505: já foi enviado hoje a esta pessoa
        continue;
      }

      const mail = montarLembrete({ condominio: ctx.condominio, administrador: ctx.administrador, destinatarioNome: d.nome, candidato: c, hoje });
      try {
        await enviarEmail({ para: d.email, assunto: mail.assunto, texto: mail.texto, html: mail.html, deNome: ctx.condominio.nome, responderPara: ctx.administrador.email });
        out.enviados++;
      } catch (e) {
        console.error("Erro ao enviar lembrete", e instanceof Error ? e.message : e);
        await sb.from("lembretes").update({ estado: "falhou" }).eq("id", linha.id); // liberta o dia para nova tentativa
        out.falhas++;
      }
    }
  }

  if (out.enviados + out.falhas > 0) {
    await sb.from("registo_atividade").insert({
      condominio_id: condominioId,
      pessoa_id: opcoes.pessoaId ?? null,
      acao: "lembretes.enviados",
      entidade: "lembretes",
      detalhe: { modo: opcoes.modo, ...out },
    });
  }
  return out;
}
