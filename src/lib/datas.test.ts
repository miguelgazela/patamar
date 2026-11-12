import { describe, expect, it } from "vitest";
import { adicionarDias, diasEntre, formatarData, hojeEmLisboa, meses, dataValida, nomeDoMes, primeiroDoMes, somarMeses } from "./datas";

describe("datas", () => {
  it("formata dd/mm/aaaa", () => expect(formatarData("2026-11-09")).toBe("09/11/2026"));
  it("soma dias atravessando meses e anos", () => {
    expect(adicionarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(adicionarDias("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("conta dias entre datas (sem problemas de hora de verão)", () => {
    expect(diasEntre("2026-03-28", "2026-03-30")).toBe(2);
    expect(diasEntre("2026-10-24", "2026-10-26")).toBe(2);
    expect(diasEntre("2026-11-09", "2026-11-01")).toBe(-8);
  });
  it("lista meses inclusive", () => {
    expect(meses("2026-11-01", "2027-02-01")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]);
  });
  it("primeiro do mês", () => expect(primeiroDoMes("2026-11-19")).toBe("2026-11-01"));
  it("hoje em Lisboa usa o fuso Europe/Lisbon", () => {
    // 23:30 UTC de inverno = 23:30 em Lisboa; 23:30 UTC de verão = 00:30 do dia seguinte.
    expect(hojeEmLisboa(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
    expect(hojeEmLisboa(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-16");
  });
  it("nome do mês em português", () => expect(nomeDoMes("2026-03-01")).toBe("março de 2026"));
  it("soma meses atravessando anos", () => {
    expect(somarMeses("2026-11-01", 2)).toBe("2027-01-01");
    expect(somarMeses("2026-01-01", -1)).toBe("2025-12-01");
    expect(somarMeses("2026-06-01", 0)).toBe("2026-06-01");
  });
  it("dataValida rejeita dias inexistentes", () => {
    expect(dataValida("2026-02-28")).toBe(true);
    expect(dataValida("2028-02-29")).toBe(true);
    for (const t of ["2026-02-31", "2026-13-01", "2026-2-3", "abc", ""]) expect(dataValida(t)).toBe(false);
  });
});
