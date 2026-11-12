import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { FaturaLidaSchema, type FaturaLida } from "./tipos";

export type TipoImagem = "image/jpeg" | "image/png" | "image/webp";

/** Identifica o formato pelos primeiros bytes; o MIME enviado pelo cliente não é de confiança. */
export function detetarImagem(b: Uint8Array): TipoImagem | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export const MODELO_PADRAO = "claude-opus-5-5";

const INSTRUCOES = `Lê a fatura (imagem) e extrai os dados da despesa. É uma fatura portuguesa paga por um condomínio.
- total_cent: o total a pagar, com IVA, em cêntimos inteiros (ex.: 123,45 € -> 12345). Nunca somes linhas à mão se o total estiver impresso.
- data_emissao: a data de emissão (não a de vencimento), no formato AAAA-MM-DD.
- fornecedor e nif_fornecedor: de quem EMITIU a fatura (cabeçalho do documento). O NIF do cliente (o condomínio) não é o do fornecedor.
- categoria: luz (eletricidade), agua, limpeza, elevador, seguro, manutencao (reparações), administracao, ou outro.
- Se um campo estiver ilegível ou ausente, devolve null. Não inventes valores.`;

/**
 * Lê uma fatura a partir de uma imagem. Devolve null se o modelo recusar ou não conseguir ler.
 * O cliente é injetado para poder ser simulado nos testes.
 */
export async function lerFatura(
  client: Pick<Anthropic, "messages">,
  imagemBase64: string,
  tipo: TipoImagem,
  opcoes: { nifCondominio?: string | null; modelo?: string } = {},
): Promise<FaturaLida | null> {
  const contexto = opcoes.nifCondominio ? `\nO NIF do condomínio (cliente) é ${opcoes.nifCondominio}.` : "";
  const resposta = await client.messages.parse({
    model: opcoes.modelo ?? MODELO_PADRAO,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(FaturaLidaSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipo, data: imagemBase64 } },
          { type: "text", text: INSTRUCOES + contexto },
        ],
      },
    ],
  });
  if (resposta.stop_reason === "refusal" || resposta.stop_reason === "max_tokens") return null;
  return resposta.parsed_output ?? null;
}
