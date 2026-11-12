import "server-only";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { gerarAta, gerarDeclaracao, gerarRelatorio, type PdfGerado, type TipoPdf } from "./gerar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida os parâmetros e gera o PDF. Só administradores. Devolve null se algo estiver errado. */
export async function pdfDoPedido(tipo: TipoPdf, params: { ano?: string | null; fracao?: string | null }): Promise<{ status: 200; pdf: PdfGerado } | { status: 400 | 403 | 404 }> {
  const hoje = hojeEmLisboa();
  const papel = await papelDoUtilizador(hoje);
  if (papel.tipo !== "administrador") return { status: 403 };

  if (tipo === "declaracao") {
    if (!params.fracao || !UUID.test(params.fracao)) return { status: 400 };
    const sb = await criarClienteServidor();
    const { data } = await sb.from("pessoas").select("nome").eq("id", papel.pessoaId).single();
    const pdf = await gerarDeclaracao(papel.condominioId, params.fracao, hoje, data?.nome ?? "O Administrador");
    return pdf ? { status: 200, pdf } : { status: 404 };
  }
  const ano = Number(params.ano);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { status: 400 };
  return { status: 200, pdf: tipo === "relatorio" ? await gerarRelatorio(papel.condominioId, ano) : await gerarAta(papel.condominioId, ano) };
}
