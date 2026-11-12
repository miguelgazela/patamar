import "server-only";
import { hojeEmLisboa, type Data } from "@/lib/datas";
import { montarModeloAta } from "@/lib/documentos/ata";
import { montarDeclaracao } from "@/lib/documentos/declaracao";
import { calcularRelatorio, type AlocacaoRel, type DespesaRel, type QuotaRel } from "@/lib/documentos/relatorio";
import { gerarModeloAtaPdf } from "@/lib/pdf/ata";
import { gerarDeclaracaoPdf } from "@/lib/pdf/declaracao";
import { gerarRelatorioPdf } from "@/lib/pdf/relatorio";
import { saldoDaFracao } from "@/lib/saldos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerTodas } from "@/lib/supabase/todas";

export type TipoPdf = "relatorio" | "declaracao" | "ata";
export interface PdfGerado {
  buffer: Buffer;
  nomeFicheiro: string;
  titulo: string;
}

const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function condominio(condominioId: string) {
  const sb = await criarClienteServidor();
  const { data, error } = await sb.from("condominios").select("nome, morada, nif, iban, modo_quota, valor_quota_cent, fundo_reserva_pct, dia_vencimento").eq("id", condominioId).single();
  if (error) throw error;
  return data;
}

export async function gerarRelatorio(condominioId: string, ano: number): Promise<PdfGerado> {
  const sb = await criarClienteServidor();
  const [c, quotas, pq, despesas] = await Promise.all([
    condominio(condominioId),
    lerTodas(() => sb.from("quotas").select("id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").eq("condominio_id", condominioId).order("id")),
    lerTodas(() => sb.from("pagamento_quotas").select("quota_id, valor_cent, pagamentos(data)").eq("condominio_id", condominioId).order("pagamento_id").order("quota_id")),
    lerTodas(() => sb.from("despesas").select("data, valor_cent, categoria, fornecedor, paga_pelo_fundo").eq("condominio_id", condominioId).order("id")),
  ]);
  for (const r of [quotas, pq, despesas]) if (r.error) throw r.error;

  const q: QuotaRel[] = quotas.data!.filter((x) => x.estado !== "anulada").map((x) => ({ id: x.id, mes: x.mes, valorCent: x.valor_cent, fundoReservaCent: x.fundo_reserva_cent, dataLimite: x.data_limite }));
  const a: AlocacaoRel[] = pq.data!.map((x) => ({ quotaId: x.quota_id, valorCent: x.valor_cent, data: (x.pagamentos as unknown as { data: string }).data }));
  const d: DespesaRel[] = despesas.data!.map((x) => ({ data: x.data, valorCent: x.valor_cent, categoria: x.categoria, fornecedor: x.fornecedor, pagaPeloFundo: x.paga_pelo_fundo }));

  const buffer = await gerarRelatorioPdf(c, calcularRelatorio(ano, q, a, d), hojeEmLisboa());
  return { buffer, nomeFicheiro: `relatorio-contas-${ano}.pdf`, titulo: `Relatório de contas ${ano}` };
}

export async function gerarAta(condominioId: string, ano: number): Promise<PdfGerado> {
  const sb = await criarClienteServidor();
  const [c, fracoes, props] = await Promise.all([
    condominio(condominioId),
    sb.from("fracoes").select("id, identificacao, permilagem").eq("condominio_id", condominioId).order("identificacao"),
    sb.from("propriedades").select("fracao_id, pessoas(nome)").eq("condominio_id", condominioId),
  ]);
  for (const r of [fracoes, props]) if (r.error) throw r.error;

  const modelo = montarModeloAta({
    condominio: c,
    ano,
    config: { modo: c.modo_quota, valorQuotaCent: c.valor_quota_cent, fundoReservaPct: Number(c.fundo_reserva_pct), diaVencimento: c.dia_vencimento },
    fracoes: fracoes.data!.map((f) => ({
      id: f.id,
      identificacao: f.identificacao,
      permilagem: Number(f.permilagem),
      proprietarios: props.data!.filter((p) => p.fracao_id === f.id).map((p) => (p.pessoas as unknown as { nome: string } | null)?.nome).filter((n): n is string => !!n),
    })),
  });
  const buffer = await gerarModeloAtaPdf(c, modelo, { modo: c.modo_quota, fundoReservaPct: Number(c.fundo_reserva_pct) });
  return { buffer, nomeFicheiro: `modelo-ata-${ano}.pdf`, titulo: `Modelo de ata ${ano}` };
}

export async function gerarDeclaracao(condominioId: string, fracaoId: string, hoje: Data, administradorNome: string): Promise<PdfGerado | null> {
  const sb = await criarClienteServidor();
  const [c, fracao, anexos, props, quotas, pq] = await Promise.all([
    condominio(condominioId),
    sb.from("fracoes").select("id, identificacao, tipo, permilagem").eq("id", fracaoId).eq("condominio_id", condominioId).maybeSingle(),
    sb.from("anexos").select("identificacao").eq("fracao_id", fracaoId).order("identificacao"),
    sb.from("propriedades").select("pessoas(nome)").eq("fracao_id", fracaoId),
    sb.from("quotas").select("id, mes, valor_cent, fundo_reserva_cent, data_limite, estado").eq("fracao_id", fracaoId).order("mes"),
    lerTodas(() => sb.from("pagamento_quotas").select("quota_id, valor_cent").eq("condominio_id", condominioId).order("pagamento_id").order("quota_id")),
  ]);
  for (const r of [anexos, props, quotas, pq]) if (r.error) throw r.error;
  if (!fracao.data) return null;

  const lista = quotas.data!.filter((x) => x.estado !== "anulada").map((x) => ({ id: x.id, mes: x.mes, valorCent: x.valor_cent, fundoReservaCent: x.fundo_reserva_cent, dataLimite: x.data_limite }));
  const ids = new Set(lista.map((x) => x.id));
  const alocs = pq.data!.filter((a) => ids.has(a.quota_id)).map((a) => ({ quotaId: a.quota_id, valorCent: a.valor_cent }));
  const pago = new Map<string, number>();
  alocs.forEach((a) => pago.set(a.quotaId, (pago.get(a.quotaId) ?? 0) + a.valorCent));
  saldoDaFracao(lista, alocs, hoje); // valida coerência dos dados (não lança)

  const d = montarDeclaracao({
    condominio: c,
    administrador: { nome: administradorNome },
    fracao: {
      identificacao: fracao.data.identificacao,
      tipo: fracao.data.tipo,
      permilagem: Number(fracao.data.permilagem),
      anexos: anexos.data!.map((a) => a.identificacao),
      proprietarios: props.data!.map((p) => (p.pessoas as unknown as { nome: string } | null)?.nome).filter((n): n is string => !!n),
    },
    quotaMensalCent: lista.length > 0 ? lista[lista.length - 1].valorCent : c.valor_quota_cent,
    fundoReservaPct: Number(c.fundo_reserva_pct),
    quotasEmDivida: lista
      .filter((x) => x.dataLimite < hoje && x.valorCent - (pago.get(x.id) ?? 0) > 0)
      .map((x) => ({ mes: x.mes, dataLimite: x.dataLimite, restanteCent: x.valorCent - (pago.get(x.id) ?? 0) })),
    hoje,
  });
  const buffer = await gerarDeclaracaoPdf(d);
  return { buffer, nomeFicheiro: `declaracao-encargos-${slug(fracao.data.identificacao)}.pdf`, titulo: `Declaração de encargos ${fracao.data.identificacao}` };
}
