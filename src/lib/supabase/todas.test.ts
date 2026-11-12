import { describe, expect, it } from "vitest";
import { lerTodas } from "./todas";

const fonte = (n: number) => {
  const pedidos: [number, number][] = [];
  const construir = () => ({
    range: (de: number, ate: number) => {
      pedidos.push([de, ate]);
      return Promise.resolve({ data: Array.from({ length: Math.max(0, Math.min(n, ate + 1) - de) }, (_, i) => ({ i: de + i })), error: null });
    },
  });
  return { construir, pedidos };
};

describe("lerTodas", () => {
  it("junta várias páginas (o PostgREST corta às 1000 linhas)", async () => {
    const { construir, pedidos } = fonte(2500);
    const r = await lerTodas(construir);
    expect(r.data).toHaveLength(2500);
    expect(r.data[2499]).toEqual({ i: 2499 });
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("uma página exata faz um pedido extra e termina", async () => {
    const { construir, pedidos } = fonte(1000);
    expect((await lerTodas(construir)).data).toHaveLength(1000);
    expect(pedidos).toHaveLength(2);
  });
  it("vazio e erros", async () => {
    expect((await lerTodas(fonte(0).construir)).data).toEqual([]);
    const r = await lerTodas(() => ({ range: () => Promise.resolve({ data: null, error: { message: "falhou" } }) }));
    expect(r).toEqual({ data: [], error: { message: "falhou" } });
  });
});
