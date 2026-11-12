import { formatarData, nomeDoMes, type Data } from "../datas";
import type { RelatorioContas } from "../documentos/relatorio";
import { formatarEuros } from "../money";
import { assinatura, cabecalho, garantirEspaco, novoDocumento, paragrafo, seccao, tabela, terminar, MARGEM } from "./base";

const CATEGORIAS: Record<string, string> = {
  luz: "Luz", agua: "Água", limpeza: "Limpeza", elevador: "Elevador", seguro: "Seguro",
  manutencao: "Manutenção", administracao: "Administração", outro: "Outro",
};
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function gerarRelatorioPdf(condominio: { nome: string; morada: string; nif: string | null }, r: RelatorioContas, hoje: Data): Promise<Buffer> {
  const doc = novoDocumento(`Relatório de contas ${r.ano} · ${condominio.nome}`);
  const e = formatarEuros;

  cabecalho(doc, condominio, `Relatório de contas de ${r.ano}`, `1 de janeiro a 31 de dezembro de ${r.ano} · emitido a ${formatarData(hoje)}`);

  seccao(doc, "Resumo");
  tabela(
    doc,
    [{ titulo: "", largura: 340 }, { titulo: "Valor", largura: 155, alinhar: "right" }],
    [
      [`Saldo a 1 de janeiro de ${r.ano}`, e(r.saldoInicialCent)],
      ["Receitas (quotas recebidas)", e(r.totalReceitasCent)],
      ["Despesas", `-${e(r.totalDespesasCent).replace("-", "")}`],
      [`Saldo a 31 de dezembro de ${r.ano}`, e(r.saldoFinalCent)],
    ],
    { totais: true },
  );
  paragrafo(doc, `Do saldo final, ${e(r.fundoFinalCent)} pertencem ao fundo comum de reserva e ${e(r.saldoFinalCent - r.fundoFinalCent)} estão disponíveis para despesas correntes.`, { tamanho: 9 });

  seccao(doc, "Receitas por mês");
  tabela(
    doc,
    [{ titulo: "Mês", largura: 340 }, { titulo: "Quotas recebidas", largura: 155, alinhar: "right" }],
    [...r.receitasPorMes.map((v, i) => [cap(nomeDoMes(`${r.ano}-${String(i + 1).padStart(2, "0")}-01`).replace(` de ${r.ano}`, "")), e(v)]), ["Total", e(r.totalReceitasCent)]],
    { totais: true },
  );

  seccao(doc, "Despesas por categoria");
  if (r.despesasPorCategoria.length === 0) paragrafo(doc, "Não foram registadas despesas neste ano.");
  else
    tabela(
      doc,
      [{ titulo: "Categoria", largura: 340 }, { titulo: "Total", largura: 155, alinhar: "right" }],
      [...r.despesasPorCategoria.map((c) => [CATEGORIAS[c.categoria] ?? c.categoria, e(c.totalCent)]), ["Total", e(r.totalDespesasCent)]],
      { totais: true },
    );

  seccao(doc, "Fundo comum de reserva");
  tabela(
    doc,
    [{ titulo: "", largura: 340 }, { titulo: "Valor", largura: 155, alinhar: "right" }],
    [
      [`Saldo a 1 de janeiro de ${r.ano}`, e(r.fundoInicialCent)],
      ["Contribuições do ano", e(r.fundoRecebidoCent)],
      ["Utilizado em despesas", `-${e(r.fundoUsadoCent)}`],
      [`Saldo a 31 de dezembro de ${r.ano}`, e(r.fundoFinalCent)],
    ],
    { totais: true },
  );

  seccao(doc, "Quotas");
  tabela(
    doc,
    [{ titulo: "", largura: 340 }, { titulo: "Valor", largura: 155, alinhar: "right" }],
    [
      [`Quotas emitidas em ${r.ano}`, e(r.quotasEmitidasCent)],
      [`Quotas vencidas por pagar a 31 de dezembro de ${r.ano} (total do prédio)`, e(r.quotasPorCobrarCent)],
    ],
  );

  if (r.despesas.length > 0) {
    seccao(doc, "Detalhe das despesas");
    tabela(
      doc,
      [
        { titulo: "Data", largura: 62 },
        { titulo: "Fornecedor", largura: 190 },
        { titulo: "Categoria", largura: 95 },
        { titulo: "Valor", largura: 78, alinhar: "right" },
        { titulo: "Fundo", largura: 70, alinhar: "center" },
      ],
      r.despesas.map((d) => [formatarData(d.data), d.fornecedor ?? "—", CATEGORIAS[d.categoria] ?? d.categoria, e(d.valorCent), d.pagaPeloFundo ? "Sim" : ""]),
    );
  }

  garantirEspaco(doc, 120);
  paragrafo(doc, "Valores calculados com base nos pagamentos e despesas registados na plataforma. Este relatório não substitui a contabilidade nem a consulta dos documentos originais (faturas e extratos).", { tamanho: 8, cor: "#4A5568" });
  doc.moveDown(2);
  const y = doc.y + 30;
  assinatura(doc, "O Administrador", MARGEM, y);
  assinatura(doc, "Aprovado em assembleia de ___/___/______", doc.page.width - MARGEM - 220, y, 220);
  return terminar(doc);
}
