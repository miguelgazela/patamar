import { pdfDoPedido } from "@/lib/documentos/pedido";
import type { TipoPdf } from "@/lib/documentos/gerar";

const TIPOS = ["relatorio", "declaracao", "ata"];

export async function GET(request: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  if (!TIPOS.includes(tipo)) return new Response("Tipo de documento desconhecido", { status: 404 });
  const q = new URL(request.url).searchParams;
  const r = await pdfDoPedido(tipo as TipoPdf, { ano: q.get("ano"), fracao: q.get("fracao") });
  if (r.status !== 200) return new Response(r.status === 403 ? "Sem permissão" : r.status === 404 ? "Não encontrado" : "Pedido inválido", { status: r.status });
  return new Response(new Uint8Array(r.pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.pdf.nomeFicheiro}"`, "Cache-Control": "private, no-store" },
  });
}
