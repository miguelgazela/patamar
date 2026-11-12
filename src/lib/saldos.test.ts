import { describe, expect, it } from "vitest";
import { gerarQuotasDoMes } from "./quotas";
import { meses } from "./datas";
import {
  alocarPagamento,
  atrasoDaFracao,
  contasDoPredio,
  estadoDaQuota,
  saldoDaFracao,
  type QuotaSaldo,
} from "./saldos";

const cfg = { modo: "fixa" as const, valorQuotaCent: 4500, fundoReservaPct: 10, diaVencimento: 8 };

function quotasDe(fracaoId: string, de: string, ate: string): QuotaSaldo[] {
  return meses(de, ate).flatMap((mes) =>
    gerarQuotasDoMes(mes, cfg, [{ id: fracaoId, permilagem: 200 }]).map((q) => ({
      id: `${fracaoId}-${mes}`,
      mes,
      valorCent: q.valorCent,
      fundoReservaCent: q.fundoReservaCent,
      dataLimite: q.dataLimite,
    })),
  );
}

describe("estadoDaQuota", () => {
  const q = quotasDe("f", "2026-01-01", "2026-01-01")[0];
  it("pendente, parcial, paga", () => {
    expect(estadoDaQuota(q, 0)).toBe("pendente");
    expect(estadoDaQuota(q, 1000)).toBe("parcial");
    expect(estadoDaQuota(q, 4500)).toBe("paga");
    expect(estadoDaQuota(q, 5000)).toBe("paga");
    expect(estadoDaQuota({ ...q, anulada: true }, 0)).toBe("anulada");
  });
});

describe("alocarPagamento", () => {
  const qs = quotasDe("f", "2026-08-01", "2026-11-01");
  it("paga as mais antigas primeiro", () => {
    const r = alocarPagamento(9000, qs);
    expect(r.alocacoes).toEqual([
      { quotaId: "f-2026-08-01", valorCent: 4500 },
      { quotaId: "f-2026-09-01", valorCent: 4500 },
    ]);
    expect(r.creditoCent).toBe(0);
  });
  it("pagamento parcial e respeita o já pago", () => {
    const r = alocarPagamento(5000, qs, new Map([["f-2026-08-01", 1000]]));
    expect(r.alocacoes).toEqual([
      { quotaId: "f-2026-08-01", valorCent: 3500 },
      { quotaId: "f-2026-09-01", valorCent: 1500 },
    ]);
  });
  it("sobra vira crédito", () => {
    const r = alocarPagamento(20000, qs);
    expect(r.alocacoes.reduce((a, x) => a + x.valorCent, 0)).toBe(18000);
    expect(r.creditoCent).toBe(2000);
  });
});

describe("saldoDaFracao e atraso (caso do 2.º Esq. do seed)", () => {
  const qs = quotasDe("f4", "2026-01-01", "2026-11-01");
  const pagas = qs.filter((q) => q.mes <= "2026-07-01").map((q) => ({ quotaId: q.id, valorCent: q.valorCent }));
  const hoje = "2026-11-09";

  it("deve agosto a novembro", () => {
    const s = saldoDaFracao(qs, pagas, hoje);
    expect(s.quotasEmAtraso).toBe(4);
    expect(s.emDividaCent).toBe(18000);
    expect(s.emitidoCent).toBe(49500);
    expect(s.pagoCent).toBe(31500);
  });
  it("quota ainda por vencer não conta como dívida", () => {
    expect(saldoDaFracao(qs, pagas, "2026-11-08").quotasEmAtraso).toBe(3);
  });
  it("conta 90 dias desde o primeiro incumprimento", () => {
    const a = atrasoDaFracao(qs, pagas, hoje)!;
    expect(a.primeiroIncumprimento).toBe("2026-08-08");
    expect(a.diasEmAtraso).toBe(93);
    expect(a.prazoCobranca).toBe("2026-11-06");
    expect(a.diasParaPrazo).toBe(-3);
  });
  it("sem atraso devolve null", () => {
    const todas = qs.map((q) => ({ quotaId: q.id, valorCent: q.valorCent }));
    expect(atrasoDaFracao(qs, todas, hoje)).toBeNull();
  });
  it("pagamento parcial reduz a dívida mas mantém o incumprimento original", () => {
    const parcial = [...pagas, { quotaId: "f4-2026-08-01", valorCent: 2000 }];
    expect(saldoDaFracao(qs, parcial, hoje).emDividaCent).toBe(16000);
    expect(atrasoDaFracao(qs, parcial, hoje)!.primeiroIncumprimento).toBe("2026-08-08");
  });
});

describe("contasDoPredio (igual ao seed e à função SQL)", () => {
  const fracoes = ["f1", "f2", "f3", "f4", "f5"];
  const quotas = fracoes.flatMap((f) => quotasDe(f, "2026-01-01", "2026-11-01"));
  const alocacoes = quotas
    .filter((q) => {
      const f = q.id.slice(0, 2);
      if (f === "f4") return q.mes <= "2026-07-01";
      if (f === "f5") return q.mes <= "2026-10-01";
      return true;
    })
    .map((q) => ({ quotaId: q.id, valorCent: q.valorCent }));
  const despesas = [
    ...Array.from({ length: 10 }, () => [3800, 2400, 9000]).flat().map((v) => ({ valorCent: v, pagaPeloFundo: false })),
    { valorCent: 18000, pagaPeloFundo: true },
  ];

  it("totais do seed", () => {
    const c = contasDoPredio(quotas, alocacoes, despesas);
    expect(c).toEqual({
      emitidoCent: 247500,
      recebidoCent: 225000,
      despesasCent: 170000,
      fundoReservaCent: 4500,
      saldoCent: 55000,
      saldoCorrenteCent: 50500,
    });
  });
});
