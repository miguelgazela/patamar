import { describe, expect, it } from "vitest";
import { formatarIban, ibanValido, normalizarIban } from "./iban";

describe("iban", () => {
  it("valida IBAN portugueses", () => {
    expect(ibanValido("PT50000201231234567890154")).toBe(true);
    expect(ibanValido("pt50 0002 0123 1234 5678 9015 4")).toBe(true);
    expect(ibanValido("PT77000000000000000000000")).toBe(true);
  });
  it("rejeita controlo errado, país errado e formatos inválidos", () => {
    expect(ibanValido("PT50000201231234567890155")).toBe(false);
    expect(ibanValido("ES9121000418450200051332")).toBe(false);
    expect(ibanValido("PT5000020123")).toBe(false);
    expect(ibanValido("")).toBe(false);
  });
  it("normaliza e formata", () => {
    expect(normalizarIban(" pt50 0002 ")).toBe("PT500002");
    expect(formatarIban("PT50000201231234567890154")).toBe("PT50 0002 0123 1234 5678 9015 4");
  });
});
