import { describe, expect, it } from "vitest";
import { nifValido, normalizarNif } from "./nif";

describe("nif", () => {
  it("valida o dígito de controlo", () => {
    for (const n of ["500000000", "980000009", "123456789"]) expect(nifValido(n)).toBe(true);
    expect(nifValido("123456788")).toBe(false);
    expect(nifValido("980000008")).toBe(false);
  });
  it("rejeita formatos inválidos e prefixos inexistentes", () => {
    for (const n of ["", "12345678", "1234567890", "abcdefghi", "400000000", "000000000"]) expect(nifValido(n)).toBe(false);
    expect(nifValido(null)).toBe(false);
    expect(nifValido(undefined)).toBe(false);
  });
  it("normaliza prefixo PT, espaços e pontos", () => {
    expect(normalizarNif("PT 500 000 000")).toBe("500000000");
    expect(normalizarNif("500.000.000")).toBe("500000000");
    expect(normalizarNif("")).toBeNull();
    expect(normalizarNif(null)).toBeNull();
  });
});
