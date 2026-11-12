import { describe, expect, it } from "vitest";
import { decodificar, detetarDelimitador, lerCsv } from "./csv";
import { detetarCabecalho, lerData, lerMovimentos, lerValor, mapeamentoAuto } from "./parse";
import { preverAlocacoes, sugerir, type FracaoInfo } from "./sugerir";

describe("lerCsv", () => {
  it("lê ; com aspas e vírgula decimal", () => {
    const l = lerCsv('Data;Descrição;Valor\r\n31/10/2026;"TRF; DE JOÃO";"1.234,56"\r\n');
    expect(l).toEqual([["Data", "Descrição", "Valor"], ["31/10/2026", "TRF; DE JOÃO", "1.234,56"]]);
  });
  it("deteta o separador e ignora BOM e linhas vazias", () => {
    expect(detetarDelimitador("a,b,c\n1,2,3")).toBe(",");
    expect(detetarDelimitador("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(lerCsv("﻿a;b\n\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("aspas escapadas", () => expect(lerCsv('a;b\n"diz ""olá""";2')[1][0]).toBe('diz "olá"'));
  it("descodifica Windows-1252 quando UTF-8 falha", () => {
    const latin1 = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]); // "João"
    expect(decodificar(latin1.buffer)).toBe("João");
    expect(decodificar(new TextEncoder().encode("João").buffer as ArrayBuffer)).toBe("João");
  });
});

describe("lerData", () => {
  it("formatos comuns", () => {
    expect(lerData("31/10/2026")).toBe("2026-10-31");
    expect(lerData("1-2-26")).toBe("2026-02-01");
    expect(lerData("2026-10-31 14:03:00")).toBe("2026-10-31");
    expect(lerData("31.10.2026")).toBe("2026-10-31");
  });
  it("rejeita datas impossíveis e lixo", () => {
    for (const t of ["31/02/2026", "13/13/2026", "abc", "", "2026"]) expect(lerData(t)).toBeNull();
  });
});

describe("lerValor", () => {
  it("formatos pt e en", () => {
    expect(lerValor("45")).toBe(4500);
    expect(lerValor("45,5")).toBe(4550);
    expect(lerValor("1.234,56")).toBe(123456);
    expect(lerValor("1 234,56 €")).toBe(123456);
    expect(lerValor("1,234.56")).toBe(123456);
    expect(lerValor("1.234")).toBe(123400);
    expect(lerValor("1234.56")).toBe(123456);
    expect(lerValor("+45,00")).toBe(4500);
  });
  it("negativos", () => {
    expect(lerValor("-45,00")).toBe(-4500);
    expect(lerValor("45,00-")).toBe(-4500);
    expect(lerValor("(45,00)")).toBe(-4500);
  });
  it("inválidos", () => {
    for (const t of ["", "abc", "1,2,3", "12,345"]) expect(lerValor(t)).toBeNull();
  });
});

const CSV = `Conta;PT50 0000
Extrato de 01/10/2026 a 31/10/2026

Data Mov.;Data Valor;Descrição;Débito;Crédito;Saldo
05/10/2026;05/10/2026;TRF DE CARLOS PEREIRA QUOTA 1 ESQ;;45,00;1.045,00
06/10/2026;06/10/2026;PAGAMENTO LUZ;38,00;;1.007,00
07/10/2026;07/10/2026;TRF JOAO SILVA;;45,00;1.052,00
07/10/2026;07/10/2026;TRF JOAO SILVA;;45,00;1.097,00
xx;xx;LINHA ESTRANHA;;;`;

describe("mapeamento e movimentos", () => {
  const linhas = lerCsv(CSV);
  it("encontra o cabeçalho depois do lixo inicial", () => expect(detetarCabecalho(linhas)).toBe(2));
  it("adivinha as colunas", () => {
    const m = mapeamentoAuto(linhas[2]);
    expect(m).toEqual({ data: "Data Mov.", descricao: "Descrição", modo: "credito_debito", credito: "Crédito", debito: "Débito" });
  });
  it("só devolve créditos, conta ignorados e distingue movimentos idênticos", () => {
    const r = lerMovimentos(linhas, 2, mapeamentoAuto(linhas[2])!);
    expect(r.movimentos).toHaveLength(3);
    expect(r.semEntrada).toBe(1);
    expect(r.invalidas).toBe(1);
    const [a, b, c] = r.movimentos;
    expect(a).toMatchObject({ data: "2026-10-05", valorCent: 4500, descricao: "TRF DE CARLOS PEREIRA QUOTA 1 ESQ" });
    expect(b.chave).not.toBe(c.chave); // dois pagamentos iguais no mesmo dia
    expect(b.chave.endsWith("|1")).toBe(true);
    expect(c.chave.endsWith("|2")).toBe(true);
  });
  it("coluna única de valor com sinal", () => {
    const l = lerCsv("Data;Descricao;Valor\n01/11/2026;TRF X;45,00\n02/11/2026;DEB Y;-10,00");
    const m = mapeamentoAuto(l[0])!;
    expect(m.modo).toBe("valor");
    expect(lerMovimentos(l, 0, m).movimentos).toHaveLength(1);
  });
});

const f = (id: string, identificacao: string, donos: string[], abertas: [string, number][], quota = 4500): FracaoInfo => ({
  id, identificacao, proprietarios: donos, quotaMensalCent: quota,
  quotasAbertas: abertas.map(([mes, restanteCent], i) => ({ id: `${id}-q${i}`, mes, restanteCent })),
});
const FRACOES = [
  f("a", "1.º Esq.", ["Carlos Pereira"], [["2026-11-01", 4500]]),
  f("b", "1.º Dto.", ["Helena Costa", "Jorge Costa"], []),
  f("c", "2.º Esq.", ["Paulo Ferreira"], [["2026-08-01", 4500], ["2026-09-01", 4500], ["2026-10-01", 4500], ["2026-11-01", 4500]]),
];
const mov = (descricao: string, valorCent: number) => ({ data: "2026-11-09", valorCent, descricao, chave: descricao + valorCent });

describe("sugerir", () => {
  it("nome completo + valor = confiança alta", () => {
    const s = sugerir(mov("TRF DE PAULO FERREIRA", 9000), FRACOES, []);
    expect(s).toMatchObject({ fracaoId: "c", confianca: "alta" });
    expect(s.motivos[0]).toMatch(/Nome/);
  });
  it("ignora acentos e maiúsculas", () => {
    expect(sugerir(mov("transferência helena costa", 4500), FRACOES, []).fracaoId).toBe("b");
  });
  it("identificação da fração na descrição", () => {
    expect(sugerir(mov("QUOTA NOV 1 ESQ", 4500), FRACOES, []).fracaoId).toBe("a");
    expect(sugerir(mov("QUOTA 11 ESQ", 3000), FRACOES, []).fracaoId).toBeNull(); // 11 esq não é 1 esq
  });
  it("valor igual à dívida de uma só fração sugere-a com confiança baixa", () => {
    const s = sugerir(mov("TRF 123", 18000), FRACOES, []);
    expect(s).toMatchObject({ fracaoId: "c", confianca: "baixa" });
  });
  it("não adivinha quando várias frações pagam o mesmo valor", () => {
    const iguais = [f("x", "A", ["Ana Reis"], []), f("y", "B", ["Rui Sá"], [])];
    expect(sugerir(mov("TRF 999", 4500), iguais, [])).toMatchObject({ fracaoId: null, confianca: "nenhuma" });
  });
  it("aprende com pagamentos anteriores", () => {
    const hist = [{ descricao: "TRF REF 20481 SILVA E FILHOS", fracaoId: "b" }];
    expect(sugerir(mov("trf ref 20481 silva e filhos", 4500), FRACOES, hist)).toMatchObject({ fracaoId: "b", confianca: "alta" });
  });
  it("sem pistas, sem sugestão", () => {
    expect(sugerir(mov("JUROS", 777), FRACOES, [])).toMatchObject({ fracaoId: null, confianca: "nenhuma", alternativas: [] });
  });
});

describe("preverAlocacoes", () => {
  it("distribui pelas quotas mais antigas e conta pagamentos anteriores do mesmo ficheiro", () => {
    const r = preverAlocacoes(
      [
        { id: "1", fracaoId: "c", valorCent: 6000, data: "2026-11-01" },
        { id: "2", fracaoId: "c", valorCent: 6000, data: "2026-11-02" },
      ],
      FRACOES,
    );
    expect(r.get("1")!.alocadas.map((x) => [x.mes, x.valorCent])).toEqual([["2026-08-01", 4500], ["2026-09-01", 1500]]);
    expect(r.get("2")!.alocadas.map((x) => [x.mes, x.valorCent])).toEqual([["2026-09-01", 3000], ["2026-10-01", 3000]]);
  });
  it("assinala o que sobra", () => {
    const r = preverAlocacoes([{ id: "1", fracaoId: "a", valorCent: 10000, data: "2026-11-01" }], FRACOES);
    expect(r.get("1")!.sobraCent).toBe(5500);
  });
});
