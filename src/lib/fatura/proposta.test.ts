import { describe, expect, it, vi } from "vitest";
import { nifValido, normalizarNif } from "@/lib/nif";
import { construirProposta } from "./proposta";
import { detetarImagem, lerFatura } from "./ler";
import type { FaturaLida } from "./tipos";

const base: FaturaLida = {
  total_cent: 3820,
  data_emissao: "2026-10-15",
  fornecedor: "  Eletricidade Exemplo, S.A. ",
  nif_fornecedor: "PT 500 000 000",
  categoria: "luz",
  descricao: "Fatura de eletricidade outubro",
};

describe("nifValido", () => {
  it("aceita NIF com controlo certo e rejeita errados", () => {
    expect(nifValido("500000000")).toBe(true);
    expect(nifValido("500000001")).toBe(false);
    expect(nifValido("12345")).toBe(false);
    expect(nifValido(null)).toBe(false);
    expect(nifValido("400000000")).toBe(false); // prefixo inexistente
  });
  it("normaliza prefixo PT e separadores", () => {
    expect(normalizarNif("PT 500.000.000")).toBe("500000000");
    expect(normalizarNif("")).toBeNull();
  });
});

describe("construirProposta", () => {
  it("fatura limpa não tem avisos", () => {
    const p = construirProposta(base, "2026-11-09");
    expect(p.avisos).toEqual([]);
    expect(p).toMatchObject({ valorCent: 3820, data: "2026-10-15", fornecedor: "Eletricidade Exemplo, S.A.", nif: "500000000" });
  });
  it("marca NIF inválido, mas mantém-no para o administrador corrigir", () => {
    const p = construirProposta({ ...base, nif_fornecedor: "500000001" }, "2026-11-09");
    expect(p.nif).toBe("500000001");
    expect(p.avisos.map((a) => a.campo)).toEqual(["nif"]);
  });
  it("rejeita o NIF do condomínio como se fosse do fornecedor", () => {
    const p = construirProposta({ ...base, nif_fornecedor: "500000000" }, "2026-11-09", "500000000");
    expect(p.nif).toBeNull();
    expect(p.avisos[0].campo).toBe("nif");
  });
  it("data futura, valor zero e campos nulos geram avisos", () => {
    const p = construirProposta({ ...base, data_emissao: "2027-01-01", total_cent: 0, fornecedor: null, nif_fornecedor: null }, "2026-11-09");
    expect(p.valorCent).toBeNull();
    expect(p.data).toBeNull();
    expect(p.avisos.map((a) => a.campo).sort()).toEqual(["data", "fornecedor", "nif", "valor"]);
  });
});

describe("lerFatura", () => {
  const fake = (r: unknown) => ({ messages: { parse: vi.fn().mockResolvedValue(r) } }) as never;

  it("devolve o resultado estruturado", async () => {
    const client = fake({ stop_reason: "end_turn", parsed_output: base });
    expect(await lerFatura(client, "AAA", "image/jpeg")).toEqual(base);
  });
  it("devolve null em recusa ou truncagem", async () => {
    expect(await lerFatura(fake({ stop_reason: "refusal", parsed_output: null }), "AAA", "image/jpeg")).toBeNull();
    expect(await lerFatura(fake({ stop_reason: "max_tokens", parsed_output: base }), "AAA", "image/jpeg")).toBeNull();
  });
  it("envia a imagem e o NIF do condomínio ao modelo", async () => {
    const client = fake({ stop_reason: "end_turn", parsed_output: base });
    await lerFatura(client, "QUJD", "image/png", { nifCondominio: "900000001" });
    const args = (client as { messages: { parse: ReturnType<typeof vi.fn> } }).messages.parse.mock.calls[0][0];
    expect(args.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/png", data: "QUJD" } });
    expect(args.messages[0].content[1].text).toContain("900000001");
  });
});

describe("detetarImagem", () => {
  it("reconhece JPEG, PNG e WebP pelos bytes", () => {
    expect(detetarImagem(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(detetarImagem(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detetarImagem(Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0]))).toBe("image/webp");
  });
  it("rejeita outros conteúdos, mesmo com MIME de imagem", () => {
    expect(detetarImagem(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(detetarImagem(Buffer.from("%PDF-1.4 ......"))).toBeNull();
    expect(detetarImagem(new Uint8Array())).toBeNull();
  });
});
