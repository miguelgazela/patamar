import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Teste de integração contra o Supabase local (`supabase start`). Só corre com RODAR_INTEGRACAO=1:
 *   RODAR_INTEGRACAO=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... npm test
 */
const correr = process.env.RODAR_INTEGRACAO === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!correr)("migração do Excel (integração)", () => {
  const sb = correr ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : (null as never);
  let cond = "";
  const fr: Record<string, string> = {};

  beforeAll(async () => {
    const { data: c, error } = await sb.from("condominios").insert({ nome: "Teste Migração", morada: "Rua X", modo_quota: "fixa", valor_quota_cent: 4500, fundo_reserva_pct: 10, dia_vencimento: 8 }).select("id").single();
    if (error) throw error;
    cond = c.id;
    for (const [nome, perm] of [["A", 300], ["B", 300], ["C", 400]] as const) {
      const { data } = await sb.from("fracoes").insert({ condominio_id: cond, identificacao: nome, permilagem: perm }).select("id").single();
      fr[nome] = data!.id;
    }
  });
  afterAll(async () => {
    if (cond) await sb.from("condominios").delete().eq("id", cond);
  });

  const meses = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];
  const estados = async (f: string) => (await sb.from("quotas").select("mes, estado").eq("fracao_id", f).order("mes")).data!.map((q) => q.estado);

  it("gera as quotas e regista um saldo de abertura por fração, pelas quotas mais antigas", async () => {
    const { executarMigracao } = await import("./migracao-envio");
    const ctx = { condominioId: cond, pessoaId: null, hoje: "2026-11-12", de: "2026-01-01", ate: "2026-06-01", meses };
    const r = await executarMigracao(sb, ctx, { [fr.A]: "270,00", [fr.B]: "100,00", [fr.C]: "" });
    expect(r).toMatchObject({ quotasCriadas: 18, pagamentos: 2, duplicados: 0, erros: [] });
    expect(await estados(fr.A)).toEqual(Array(6).fill("paga"));
    expect(await estados(fr.B)).toEqual(["paga", "paga", "parcial", "pendente", "pendente", "pendente"]);
    expect(await estados(fr.C)).toEqual(Array(6).fill("pendente"));
    const { data: pag } = await sb.from("pagamentos").select("data, meio, valor_cent").eq("condominio_id", cond).order("valor_cent");
    expect(pag).toEqual([{ data: "2026-06-30", meio: "outro", valor_cent: 10000 }, { data: "2026-06-30", meio: "outro", valor_cent: 27000 }]);
  });

  it("repetir não duplica nada", async () => {
    const { executarMigracao } = await import("./migracao-envio");
    const ctx = { condominioId: cond, pessoaId: null, hoje: "2026-11-12", de: "2026-01-01", ate: "2026-06-01", meses };
    const r = await executarMigracao(sb, ctx, { [fr.A]: "270,00", [fr.B]: "100,00" });
    expect(r.quotasCriadas).toBe(0);
    expect(r.pagamentos).toBe(0);
    expect(r.erros.length + r.duplicados).toBeGreaterThan(0);
    const { count } = await sb.from("pagamentos").select("id", { count: "exact", head: true }).eq("condominio_id", cond);
    expect(count).toBe(2);
  });

  it("recusa valores acima do que há por pagar e valores inválidos", async () => {
    const { executarMigracao } = await import("./migracao-envio");
    const ctx = { condominioId: cond, pessoaId: null, hoje: "2026-11-12", de: "2026-01-01", ate: "2026-06-01", meses };
    const r = await executarMigracao(sb, ctx, { [fr.C]: "9999,00", [fr.B]: "abc" });
    expect(r.pagamentos).toBe(0);
    expect(r.erros.map((e) => e.fracao).sort()).toEqual(["B", "C"]);
  });

  it("alargar o período só cria as quotas novas", async () => {
    const { executarMigracao } = await import("./migracao-envio");
    const ctx = { condominioId: cond, pessoaId: null, hoje: "2026-11-12", de: "2025-12-01", ate: "2026-06-01", meses: ["2025-12-01", ...meses] };
    const r = await executarMigracao(sb, ctx, {});
    expect(r.quotasCriadas).toBe(3); // dezembro de 2025 nas 3 frações
  });
});
