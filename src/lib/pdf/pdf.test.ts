import { describe, expect, it } from "vitest";
import { montarModeloAta } from "../documentos/ata";
import { montarDeclaracao } from "../documentos/declaracao";
import { calcularRelatorio } from "../documentos/relatorio";
import { gerarModeloAtaPdf } from "./ata";
import { gerarDeclaracaoPdf } from "./declaracao";
import { gerarRelatorioPdf } from "./relatorio";

const cond = { nome: "Condomínio Rua das Flores, 12", morada: "Rua das Flores, 12, 1000-001 Lisboa", nif: "980000009" };
const ePdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-" && b.length > 1500;
const paginas = (b: Buffer) => (b.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("PDFs", () => {
  it("relatório de contas (com muitas despesas ocupa várias páginas)", async () => {
    const despesas = Array.from({ length: 120 }, (_, i) => ({ data: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`, valorCent: 1000 + i, categoria: i % 2 ? "luz" : "limpeza", fornecedor: `Fornecedor ${i}`, pagaPeloFundo: i % 20 === 0 }));
    const r = calcularRelatorio(2026, [], [], despesas);
    const pdf = await gerarRelatorioPdf(cond, r, "2026-12-31");
    expect(ePdf(pdf)).toBe(true);
    expect(paginas(pdf)).toBeGreaterThan(2);
  });
  it("declaração de encargos", async () => {
    const d = montarDeclaracao({
      condominio: { ...cond, iban: null }, administrador: { nome: "Rita Mendes" },
      fracao: { identificacao: "2.º Esq.", tipo: "habitacao", permilagem: 210, anexos: ["Box 3"], proprietarios: ["Paulo Ferreira"] },
      quotaMensalCent: 4500, fundoReservaPct: 10,
      quotasEmDivida: [{ mes: "2026-08-01", restanteCent: 4500, dataLimite: "2026-08-08" }], hoje: "2026-11-09",
    });
    expect(ePdf(await gerarDeclaracaoPdf(d))).toBe(true);
  });
  it("modelo de ata", async () => {
    const m = montarModeloAta({
      condominio: cond, ano: 2027, config: { modo: "fixa", valorQuotaCent: 4500, fundoReservaPct: 10, diaVencimento: 8 },
      fracoes: Array.from({ length: 5 }, (_, i) => ({ id: String(i), identificacao: `F${i + 1}`, permilagem: 200, proprietarios: ["Nome Apelido"] })),
    });
    expect(ePdf(await gerarModeloAtaPdf(cond, m, { modo: "fixa", fundoReservaPct: 10 }))).toBe(true);
  });
});
