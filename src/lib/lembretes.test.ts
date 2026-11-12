import { describe, expect, it } from "vitest";
import { escaparHtml } from "./html";
import { calcularLembretes, montarLembrete, type FracaoParaLembrete } from "./lembretes";

const CFG = { toleranciaDias: 5, intervaloDias: 15 };
const q = (mes: string, dataLimite: string, restanteCent = 4500, valorCent = 4500) => ({ mes, valorCent, restanteCent, dataLimite });
const donos = [{ id: "p1", nome: "Paulo Ferreira", email: "paulo@example.com" }];

const base = (over: Partial<FracaoParaLembrete> = {}): FracaoParaLembrete => ({
  id: "f4", identificacao: "2.º Esq.", proprietarios: donos,
  quotasVencidas: [q("2026-08-01", "2026-08-08"), q("2026-09-01", "2026-09-08")], ultimoLembrete: null, ...over,
});

describe("calcularLembretes", () => {
  it("ignora frações sem quotas vencidas", () => {
    expect(calcularLembretes([base({ quotasVencidas: [] })], CFG, "2026-11-09")).toEqual([]);
  });
  it("calcula dias desde o primeiro incumprimento, total e prazo de 90 dias", () => {
    const [c] = calcularLembretes([base()], CFG, "2026-11-09");
    expect(c).toMatchObject({ primeiroIncumprimento: "2026-08-08", diasDesdePrimeiroIncumprimento: 93, totalCent: 9000, prazoCobranca: "2026-11-06", elegivel: true, motivo: "ok" });
    expect(c.quotas.map((x) => x.diasEmAtraso)).toEqual([93, 62]);
  });
  it("respeita a tolerância", () => {
    const [c] = calcularLembretes([base({ quotasVencidas: [q("2026-11-01", "2026-11-08")] })], CFG, "2026-11-09");
    expect(c).toMatchObject({ elegivel: false, motivo: "tolerancia", diasDesdePrimeiroIncumprimento: 1 });
    const [d] = calcularLembretes([base({ quotasVencidas: [q("2026-11-01", "2026-11-08")] })], CFG, "2026-11-13");
    expect(d.elegivel).toBe(true);
  });
  it("respeita o intervalo entre lembretes", () => {
    const [recente] = calcularLembretes([base({ ultimoLembrete: "2026-11-01" })], CFG, "2026-11-09");
    expect(recente).toMatchObject({ elegivel: false, motivo: "intervalo", diasDesdeUltimoLembrete: 8 });
    const [antigo] = calcularLembretes([base({ ultimoLembrete: "2026-10-20" })], CFG, "2026-11-09");
    expect(antigo.elegivel).toBe(true);
  });
  it("sem email não é elegível e lista quem não tem", () => {
    const [c] = calcularLembretes([base({ proprietarios: [{ id: "p2", nome: "Sem Email", email: null }] })], CFG, "2026-11-09");
    expect(c).toMatchObject({ elegivel: false, motivo: "sem_email", semEmail: ["Sem Email"], destinatarios: [] });
  });
  it("vários proprietários com email recebem todos; ordena do mais antigo para o mais recente", () => {
    const r = calcularLembretes(
      [
        base({ id: "a", quotasVencidas: [q("2026-10-01", "2026-10-08")] }),
        base({ id: "b", proprietarios: [...donos, { id: "p3", nome: "Ana", email: "ana@example.com" }] }),
      ],
      CFG,
      "2026-11-09",
    );
    expect(r.map((x) => x.fracaoId)).toEqual(["b", "a"]);
    expect(r[0].destinatarios).toHaveLength(2);
  });
});

describe("montarLembrete", () => {
  const [candidato] = calcularLembretes([base({ quotasVencidas: [q("2026-08-01", "2026-08-08", 2500), q("2026-09-01", "2026-09-08")] })], CFG, "2026-11-09");
  const dados = {
    condominio: { nome: "Condomínio Rua das Flores, 12", morada: "Rua das Flores, 12, Lisboa", nif: "980000009", iban: "PT77000000000000000000000" },
    administrador: { nome: "Rita Mendes", email: "rita@example.com" },
    destinatarioNome: "Paulo Ferreira",
    candidato,
    hoje: "2026-11-09",
  };
  it("identifica o condomínio, as quotas, o total e como pagar", () => {
    const m = montarLembrete(dados);
    expect(m.assunto).toBe("Aviso de quotas em atraso · Condomínio Rua das Flores, 12");
    for (const t of ["Setembro de 2026", "Agosto de 2026", "09/11/2026", "PT77 0000 0000 0000 0000 0000 0", "fração 2.º Esq.", "93 dias", "Rita Mendes"]) expect(m.texto + m.html).toContain(t);
    expect(m.texto).toContain("70,00 €"); // 25,00 + 45,00
    expect(m.texto).toContain("pagamento parcial já deduzido");
  });
  it("sem IBAN manda contactar a administração", () => {
    const m = montarLembrete({ ...dados, condominio: { ...dados.condominio, iban: null } });
    expect(m.texto).toContain("contacte a administração");
  });
  it("escapa HTML em nomes", () => {
    const m = montarLembrete({ ...dados, destinatarioNome: '<script>alert(1)</script>' });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(escaparHtml(`a&b"c'`)).toBe("a&amp;b&quot;c&#39;");
  });
});
