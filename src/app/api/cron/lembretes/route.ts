import { timingSafeEqual } from "node:crypto";
import { hojeEmLisboa } from "@/lib/datas";
import { enviarLembretes } from "@/lib/lembretes-envio";
import { criarClienteAdmin } from "@/lib/supabase/admin";

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Envio automático diário de lembretes. Chamar com `Authorization: Bearer $CRON_SECRET`
 * (ex.: Vercel Cron, GitHub Actions ou um cron do servidor). Só trata condomínios com lembretes automáticos ligados.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ erro: "CRON_SECRET não configurado" }, { status: 503 });
  if (!segredoValido(request.headers.get("authorization"))) return Response.json({ erro: "Não autorizado" }, { status: 401 });

  const sb = criarClienteAdmin();
  const hoje = hojeEmLisboa();
  const { data, error } = await sb.from("condominios").select("id").eq("lembretes_automaticos", true);
  if (error) return Response.json({ erro: "Falha ao listar condomínios" }, { status: 500 });

  const resultados: Record<string, unknown> = {};
  for (const c of data) {
    try {
      resultados[c.id] = await enviarLembretes(sb, c.id, hoje, { modo: "automatico" });
    } catch (e) {
      console.error("Cron lembretes falhou", c.id, e instanceof Error ? e.message : e);
      resultados[c.id] = { erro: true };
    }
  }
  return Response.json({ data: hoje, condominios: data.length, resultados });
}
