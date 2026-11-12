import { describe, expect, it } from "vitest";
import { dataLimite, fundoReservaDe, gerarQuotasDoMes, montanteAnual, valoresDaQuota, type ConfigQuota } from "./quotas";

const fracoes = [
  { id: "f1", permilagem: 180 },
  { id: "f2", permilagem: 190 },
  { id: "f3", permilagem: 200 },
  { id: "f4", permilagem: 210 },
  { id: "f5", permilagem: 220 },
];
const fixa: ConfigQuota = { modo: "fixa", valorQuotaCent: 4500, fundoReservaPct: 10, diaVencimento: 8 };

describe("fundoReservaDe", () => {
  it("10 % de 45,00 € = 4,50 €", () => expect(fundoReservaDe(4500, 10)).toBe(450));
  it("arredonda ao cêntimo", () => {
    expect(fundoReservaDe(333, 10)).toBe(33);
    expect(fundoReservaDe(335, 10)).toBe(34);
  });
  it("aceita percentagens fracionárias e extremos", () => {
    expect(fundoReservaDe(10000, 12.5)).toBe(1250);
    expect(fundoReservaDe(4500, 0)).toBe(0);
    expect(fundoReservaDe(4500, 100)).toBe(4500);
  });
});

describe("valoresDaQuota", () => {
  it("modo fixo: igual para todas", () => {
    const v = valoresDaQuota(fixa, fracoes);
    expect([...v.values()]).toEqual([4500, 4500, 4500, 4500, 4500]);
  });
  it("modo permilagem: proporcional e soma exata ao total", () => {
    const v = valoresDaQuota({ ...fixa, modo: "permilagem", valorQuotaCent: 22500 }, fracoes);
    expect(v.get("f1")).toBe(4050);
    expect(v.get("f5")).toBe(4950);
    expect([...v.values()].reduce((a, b) => a + b, 0)).toBe(22500);
  });
  it("permilagem com total não divisível mantém a soma", () => {
    const v = valoresDaQuota({ ...fixa, modo: "permilagem", valorQuotaCent: 10001 }, fracoes);
    expect([...v.values()].reduce((a, b) => a + b, 0)).toBe(10001);
  });
});

describe("gerarQuotasDoMes", () => {
  it("gera uma quota por fração com fundo e data-limite", () => {
    const qs = gerarQuotasDoMes("2026-11-01", fixa, fracoes);
    expect(qs).toHaveLength(5);
    expect(qs[0]).toEqual({ fracaoId: "f1", mes: "2026-11-01", valorCent: 4500, fundoReservaCent: 450, dataLimite: "2026-11-08" });
  });
  it("data-limite", () => expect(dataLimite("2026-02-01", 28)).toBe("2026-02-28"));
});

describe("montanteAnual", () => {
  it("12 meses por fração", () => {
    expect(montanteAnual(fixa, fracoes).get("f3")).toBe(54000);
  });
});
