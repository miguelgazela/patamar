import { describe, expect, it } from "vitest";
import { estadoPermilagem, lerListaFracoes, lerPermilagem, telefoneValido } from "./fracoes";

describe("lerPermilagem", () => {
  it("aceita vírgula, ponto e casas decimais até 3", () => {
    expect(lerPermilagem("180")).toBe(180);
    expect(lerPermilagem("180,5")).toBe(180.5);
    expect(lerPermilagem(" 99.125 ")).toBe(99.125);
    expect(lerPermilagem("1000")).toBe(1000);
  });
  it("rejeita zero, negativos, excesso e lixo", () => {
    for (const t of ["0", "-5", "1000,1", "1001", "abc", "", "1,2345", "12 3"]) expect(lerPermilagem(t)).toBeNull();
  });
});

describe("estadoPermilagem", () => {
  it("1000 ‰ certos", () => expect(estadoPermilagem([180, 190, 200, 210, 220])).toEqual({ somaPermilagem: 1000, estado: "ok", diferenca: 0 }));
  it("não sofre de erros de vírgula flutuante", () => {
    expect(estadoPermilagem([333.333, 333.333, 333.334]).estado).toBe("ok");
    expect(estadoPermilagem([0.1, 0.2, 999.7]).estado).toBe("ok");
  });
  it("indica quanto falta ou excede", () => {
    expect(estadoPermilagem([500, 400])).toEqual({ somaPermilagem: 900, estado: "falta", diferenca: 100 });
    expect(estadoPermilagem([600, 450])).toEqual({ somaPermilagem: 1050, estado: "excede", diferenca: -50 });
    expect(estadoPermilagem([]).estado).toBe("falta");
  });
});

describe("telefoneValido", () => {
  it("aceita formatos comuns", () => {
    expect(telefoneValido("910 000 001")).toBe(true);
    expect(telefoneValido("+351 910000001")).toBe(true);
    expect(telefoneValido("12345")).toBe(false);
  });
});

describe("lerListaFracoes", () => {
  it("sem permilagem reparte 1000 ‰ em partes iguais com soma exata", () => {
    const r = lerListaFracoes("1.º Esq.\n1.º Dto.\n2.º Esq.");
    if ("erro" in r) throw new Error(r.erro);
    expect(r.fracoes.map((f) => f.permilagem)).toEqual([333.334, 333.333, 333.333]);
    expect(estadoPermilagem(r.fracoes.map((f) => f.permilagem)).estado).toBe("ok");
  });
  it("lê permilagens dadas", () => {
    const r = lerListaFracoes("R/C; 180\n1.º Esq.; 190,5\r\n\n");
    expect(r).toEqual({ fracoes: [{ identificacao: "R/C", permilagem: 180 }, { identificacao: "1.º Esq.", permilagem: 190.5 }] });
  });
  it("rejeita listas vazias, repetidas, mistas e permilagens más", () => {
    for (const t of ["", "  \n ", "A\na", "A; 100\nB", "A; abc", "; 100"]) expect("erro" in lerListaFracoes(t)).toBe(true);
  });
  it("20 frações somam 1000 ‰", () => {
    const r = lerListaFracoes(Array.from({ length: 20 }, (_, i) => `F${i + 1}`).join("\n"));
    if ("erro" in r) throw new Error(r.erro);
    expect(estadoPermilagem(r.fracoes.map((f) => f.permilagem)).estado).toBe("ok");
  });
});
