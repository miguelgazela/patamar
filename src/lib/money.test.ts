import { describe, expect, it } from "vitest";
import { formatarEuros, lerEuros, repartir } from "./money";

const N = " ";

describe("formatarEuros", () => {
  it("formata com vírgula e espaço de milhares", () => {
    expect(formatarEuros(123456)).toBe(`1${N}234,56${N}€`);
    expect(formatarEuros(4500)).toBe(`45,00${N}€`);
    expect(formatarEuros(5)).toBe(`0,05${N}€`);
    expect(formatarEuros(100000000)).toBe(`1${N}000${N}000,00${N}€`);
  });
  it("trata negativos e zero", () => {
    expect(formatarEuros(-250)).toBe(`-2,50${N}€`);
    expect(formatarEuros(0)).toBe(`0,00${N}€`);
  });
  it("rejeita não inteiros", () => {
    expect(() => formatarEuros(10.5)).toThrow(RangeError);
  });
});

describe("lerEuros", () => {
  it("lê vários formatos pt-PT", () => {
    expect(lerEuros("45")).toBe(4500);
    expect(lerEuros("45,5")).toBe(4550);
    expect(lerEuros("1 234,56 €")).toBe(123456);
    expect(lerEuros("1.234,56")).toBe(123456);
    expect(lerEuros("-3,20")).toBe(-320);
  });
  it("devolve null para lixo", () => {
    expect(lerEuros("abc")).toBeNull();
    expect(lerEuros("1,234")).toBeNull();
    expect(lerEuros("")).toBeNull();
  });
});

describe("repartir", () => {
  it("soma sempre exatamente o total", () => {
    const partes = repartir(10000, [180, 190, 200, 210, 220]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(partes).toEqual([1800, 1900, 2000, 2100, 2200]);
  });
  it("distribui restos pelo maior resto", () => {
    expect(repartir(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(repartir(1, [1, 1])).toEqual([1, 0]);
  });
  it("rejeita pesos inválidos", () => {
    expect(() => repartir(100, [0, 0])).toThrow();
  });
  it("mantém a soma com pesos arbitrários", () => {
    for (let i = 0; i < 200; i++) {
      const pesos = Array.from({ length: 1 + (i % 9) }, (_, k) => 1 + ((i * 7 + k * 13) % 400));
      const total = (i * 977) % 50000;
      expect(repartir(total, pesos).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
