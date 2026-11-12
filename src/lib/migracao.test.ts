import { describe, expect, it } from "vitest";
import { dataDoSaldo, intervaloDeMeses, lerMes } from "./migracao";

describe("lerMes", () => {
  it("aceita AAAA-MM e AAAA-MM-01", () => {
    expect(lerMes("2026-01")).toBe("2026-01-01");
    expect(lerMes(" 2026-12-01 ")).toBe("2026-12-01");
  });
  it("rejeita lixo e dias que não o 1.º", () => {
    for (const t of ["", "2026", "2026-13", "2026-00", "2026-05-15", "jan 2026"]) expect(lerMes(t)).toBeNull();
  });
});

describe("intervaloDeMeses", () => {
  const hoje = "2026-11-12";
  it("lista os meses inclusive", () => {
    const r = intervaloDeMeses("2026-01-01", "2026-03-01", hoje);
    expect(r).toEqual({ meses: ["2026-01-01", "2026-02-01", "2026-03-01"] });
  });
  it("recusa ordem trocada, futuro distante e intervalos enormes", () => {
    expect("erro" in intervaloDeMeses("2026-05-01", "2026-01-01", hoje)).toBe(true);
    expect("erro" in intervaloDeMeses("2026-01-01", "2027-12-01", hoje)).toBe(true);
    expect("erro" in intervaloDeMeses("2020-01-01", "2026-11-01", hoje)).toBe(true); // 83 meses
  });
  it("aceita até 12 meses à frente", () => {
    expect("meses" in intervaloDeMeses("2026-11-01", "2027-11-01", hoje)).toBe(true);
  });
});

describe("dataDoSaldo", () => {
  it("fim do mês, ou hoje se for futuro", () => {
    expect(dataDoSaldo("2026-02-01", "2026-11-12")).toBe("2026-02-28");
    expect(dataDoSaldo("2028-02-01", "2030-01-01")).toBe("2028-02-29");
    expect(dataDoSaldo("2026-11-01", "2026-11-12")).toBe("2026-11-12");
  });
});
