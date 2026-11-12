import { describe, expect, it } from "vitest";
import { montarModeloAta } from "./ata";
import { montarDeclaracao } from "./declaracao";
import { calcularRelatorio, type AlocacaoRel, type QuotaRel } from "./relatorio";

const quota = (id: string, mes: string, dia = "08"): QuotaRel => ({ id, mes, valorCent: 4500, fundoReservaCent: 450, dataLimite: `${mes.slice(0, 8)}${dia}` });
// 2 frações, quotas de dez/2025 a fev/2026
const quotas = ["2025-12-01", "2026-01-01", "2026-02-01"].flatMap((m, i) => [quota(`a${i}`, m), quota(`b${i}`, m)]);

describe("calcularRelatorio", () => {
  const alocs: AlocacaoRel[] = [
    { quotaId: "a0", data: "2025-12-05", valorCent: 4500 }, // antes do ano
    { quotaId: "b0", data: "2025-12-06", valorCent: 4500 },
    { quotaId: "a1", data: "2026-01-05", valorCent: 4500 },
    { quotaId: "b1", data: "2026-01-20", valorCent: 2000 }, // parcial
    { quotaId: "a2", data: "2026-02-04", valorCent: 4500 },
  ];
  const despesas = [
    { data: "2025-12-15", valorCent: 3000, categoria: "luz", fornecedor: null, pagaPeloFundo: false },
    { data: "2026-01-15", valorCent: 1000, categoria: "luz", fornecedor: "EDP", pagaPeloFundo: false },
    { data: "2026-02-15", valorCent: 500, categoria: "limpeza", fornecedor: null, pagaPeloFundo: true },
    { data: "2027-01-02", valorCent: 999, categoria: "luz", fornecedor: null, pagaPeloFundo: false },
  ];
  const r = calcularRelatorio(2026, quotas, alocs, despesas);

  it("receitas por mês só do ano", () => {
    expect(r.receitasPorMes.slice(0, 3)).toEqual([6500, 4500, 0]);
    expect(r.totalReceitasCent).toBe(11000);
  });
  it("despesas do ano por categoria, ignorando outros anos", () => {
    expect(r.totalDespesasCent).toBe(1500);
    expect(r.despesasPorCategoria).toEqual([{ categoria: "luz", totalCent: 1000 }, { categoria: "limpeza", totalCent: 500 }]);
    expect(r.despesas).toHaveLength(2);
  });
  it("saldo inicial e final", () => {
    expect(r.saldoInicialCent).toBe(9000 - 3000);
    expect(r.saldoFinalCent).toBe(6000 + 11000 - 1500);
  });
  it("fundo de reserva: inicial, recebido (10 % proporcional), usado e final", () => {
    expect(r.fundoInicialCent).toBe(900);
    expect(r.fundoRecebidoCent).toBe(450 + Math.round((2000 * 450) / 4500) + 450);
    expect(r.fundoUsadoCent).toBe(500);
    expect(r.fundoFinalCent).toBe(900 + 1100 - 500);
  });
  it("quotas emitidas no ano e por cobrar a 31/12", () => {
    expect(r.quotasEmitidasCent).toBe(4 * 4500);
    expect(r.quotasPorCobrarCent).toBe(2500 + 4500); // b1 em falta 25,00 e b2 por pagar
  });
});

describe("montarDeclaracao", () => {
  it("encargos anuais, fundo e dívida total ordenada", () => {
    const d = montarDeclaracao({
      condominio: { nome: "C", morada: "M", nif: null, iban: null },
      administrador: { nome: "Rita" },
      fracao: { identificacao: "2.º Esq.", tipo: "habitacao", permilagem: 210, anexos: ["Box 3"], proprietarios: ["Paulo"] },
      quotaMensalCent: 4500, fundoReservaPct: 10,
      quotasEmDivida: [{ mes: "2026-09-01", restanteCent: 4500, dataLimite: "2026-09-08" }, { mes: "2026-08-01", restanteCent: 2500, dataLimite: "2026-08-08" }],
      hoje: "2026-11-09",
    });
    expect(d).toMatchObject({ encargosAnuaisOrdinariosCent: 54000, fundoReservaAnualCent: 5400, totalEmDividaCent: 7000 });
    expect(d.quotasEmDivida[0].mes).toBe("2026-08-01");
  });
});

describe("montarModeloAta", () => {
  const fracoes = [
    { id: "1", identificacao: "A", permilagem: 600, proprietarios: ["X"] },
    { id: "2", identificacao: "B", permilagem: 400, proprietarios: ["Y", "Z"] },
  ];
  it("quota fixa: 12 × quota por fração e 12 vencimentos", () => {
    const m = montarModeloAta({ condominio: { nome: "C", morada: "M", nif: null }, fracoes, ano: 2027, config: { modo: "fixa", valorQuotaCent: 4500, fundoReservaPct: 10, diaVencimento: 8 } });
    expect(m.linhas.map((l) => l.montanteAnualCent)).toEqual([54000, 54000]);
    expect(m.totalAnualCent).toBe(108000);
    expect(m.totalFundoCent).toBe(2 * 5400);
    expect(m.vencimentos).toHaveLength(12);
    expect(m.vencimentos[0]).toBe("2027-01-08");
    expect(m.vencimentos[11]).toBe("2027-12-08");
  });
  it("permilagem: reparte o total mensal e a soma anual é exata", () => {
    const m = montarModeloAta({ condominio: { nome: "C", morada: "M", nif: null }, fracoes, ano: 2027, config: { modo: "permilagem", valorQuotaCent: 10000, fundoReservaPct: 10, diaVencimento: 1 } });
    expect(m.linhas.map((l) => l.quotaMensalCent)).toEqual([6000, 4000]);
    expect(m.totalAnualCent).toBe(120000);
  });
});
