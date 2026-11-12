import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";
import { exportarDados } from "@/lib/exportacao";

export async function GET() {
  const hoje = hojeEmLisboa();
  const papel = await papelDoUtilizador(hoje);
  if (papel.tipo === "desconhecido") return new Response("Sem permissão", { status: 403 });
  const dados = await exportarDados(papel.tipo);
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="patamar-dados-${hoje}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
