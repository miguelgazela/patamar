import { z } from "zod";

export const CATEGORIAS = ["luz", "agua", "limpeza", "elevador", "seguro", "manutencao", "administracao", "outro"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** O que o modelo devolve; campos ilegíveis vêm a null. */
export const FaturaLidaSchema = z.object({
  total_cent: z.number().int().nullable().describe("Total a pagar com IVA, em cêntimos inteiros (12,34 € = 1234)"),
  data_emissao: z.string().nullable().describe("Data de emissão da fatura, formato AAAA-MM-DD"),
  fornecedor: z.string().nullable().describe("Nome de quem emitiu a fatura"),
  nif_fornecedor: z.string().nullable().describe("NIF de quem emitiu a fatura, só dígitos"),
  categoria: z.enum(CATEGORIAS).describe("Categoria da despesa; 'outro' se não encaixar"),
  descricao: z.string().nullable().describe("Descrição curta do que foi faturado (máx. 80 caracteres)"),
});
export type FaturaLida = z.infer<typeof FaturaLidaSchema>;

export interface PropostaDespesa {
  valorCent: number | null;
  data: string | null;
  fornecedor: string | null;
  nif: string | null;
  categoria: Categoria;
  descricao: string | null;
  /** Campos a que o administrador deve prestar atenção. */
  avisos: { campo: "valor" | "data" | "fornecedor" | "nif"; mensagem: string }[];
}
