import { verificarAmbiente } from "@/lib/ambiente";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/** Estado do serviço para monitorização (uptime). Não expõe detalhes: os pormenores vão para os registos. */
export async function GET() {
  const amb = verificarAmbiente(process.env, process.env.NODE_ENV === "production");
  if (!amb.ok) {
    console.error("Ambiente incompleto:", amb.faltam.join(", "));
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (amb.avisos.length > 0) console.warn("Avisos de ambiente:", amb.avisos.join("; "));
  try {
    const { error } = await criarClienteAdmin().from("condominios").select("id", { head: true, count: "estimated" }).limit(1);
    if (error) throw error;
  } catch (e) {
    console.error("Base de dados inacessível:", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
