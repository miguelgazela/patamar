import { describe, expect, it } from "vitest";
import { confirmaNome } from "./confirmacao";

describe("confirmaNome", () => {
  it("aceita o nome igual, ignorando maiúsculas e espaços a mais", () => {
    expect(confirmaNome("  condomínio   rua das flores, 12 ", "Condomínio Rua das Flores, 12")).toBe(true);
  });
  it("rejeita nomes diferentes ou vazios", () => {
    expect(confirmaNome("Condomínio Rua das Flores", "Condomínio Rua das Flores, 12")).toBe(false);
    expect(confirmaNome("", "")).toBe(false);
    expect(confirmaNome("x", "")).toBe(false);
  });
});
