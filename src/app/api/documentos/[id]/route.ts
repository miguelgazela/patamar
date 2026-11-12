import { criarClienteServidor } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Descarrega um documento publicado. A RLS decide quem o pode ver (administrador e condóminos do prédio). */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Pedido inválido", { status: 400 });
  const sb = await criarClienteServidor();
  const { data: doc } = await sb.from("documentos").select("titulo, ficheiro_path").eq("id", id).maybeSingle();
  if (!doc?.ficheiro_path) return new Response("Não encontrado", { status: 404 });
  const { data: ficheiro, error } = await sb.storage.from("documentos").download(doc.ficheiro_path);
  if (error || !ficheiro) return new Response("Não encontrado", { status: 404 });
  const nome = doc.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return new Response(await ficheiro.arrayBuffer(), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
