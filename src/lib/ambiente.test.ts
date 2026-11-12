import { describe, expect, it } from "vitest";
import { verificarAmbiente } from "./ambiente";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
  SUPABASE_SERVICE_ROLE_KEY: "sr",
  NEXT_PUBLIC_APP_URL: "https://app.patamar.pt",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "Patamar <avisos@patamar.pt>",
  CRON_SECRET: "x".repeat(32),
  ANTHROPIC_API_KEY: "sk",
};

describe("verificarAmbiente", () => {
  it("produção completa está ok, sem avisos", () => {
    expect(verificarAmbiente(base, true)).toEqual({ ok: true, faltam: [], avisos: [] });
  });
  it("em desenvolvimento só exige o Supabase", () => {
    expect(verificarAmbiente({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk", SUPABASE_SERVICE_ROLE_KEY: "sr" }, false).ok).toBe(true);
    expect(verificarAmbiente({}, false).faltam).toHaveLength(3);
  });
  it("em produção recusa URLs locais, http e segredo curto", () => {
    const r = verificarAmbiente({ ...base, NEXT_PUBLIC_APP_URL: "http://localhost:3000", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", CRON_SECRET: "curto" }, true);
    expect(r.ok).toBe(false);
    expect(r.faltam.join(" ")).toMatch(/APP_URL[\s\S]*SUPABASE_URL[\s\S]*CRON_SECRET/);
  });
  it("em produção exige email e cron; avisa do Mailpit e da chave Anthropic", () => {
    const r = verificarAmbiente({ ...base, RESEND_API_KEY: "", EMAIL_DEV_URL: "http://127.0.0.1:54324", ANTHROPIC_API_KEY: undefined }, true);
    expect(r.faltam).toContain("RESEND_API_KEY");
    expect(r.avisos).toHaveLength(2);
  });
});
