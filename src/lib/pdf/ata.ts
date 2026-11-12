import { formatarData } from "../datas";
import type { ModeloAta } from "../documentos/ata";
import { formatarEuros } from "../money";
import { assinatura, cabecalho, garantirEspaco, novoDocumento, paragrafo, seccao, tabela, terminar, MARGEM } from "./base";

export function gerarModeloAtaPdf(
  condominio: { nome: string; morada: string; nif: string | null },
  m: ModeloAta,
  opcoes: { modo: "fixa" | "permilagem"; fundoReservaPct: number },
): Promise<Buffer> {
  const doc = novoDocumento(`Modelo de ata ${m.ano} · ${condominio.nome}`);
  const e = formatarEuros;
  const perm = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });

  cabecalho(doc, condominio, "Ata da assembleia de condóminos", `Modelo para preencher · contribuições de ${m.ano}`);

  paragrafo(
    doc,
    `Aos ____ dias do mês de ______________ de ________, pelas ____ horas, reuniu em ______ convocatória, no local ______________________________, a assembleia de condóminos do prédio sito em ${condominio.morada}, com a seguinte ordem de trabalhos:`,
    { alinhar: "justify" },
  );
  [
    `1. Apreciação e votação das contas do ano de ${m.ano - 1}.`,
    `2. Aprovação do orçamento e das contribuições dos condóminos para ${m.ano}.`,
    "3. Eleição do administrador.",
    "4. Outros assuntos.",
  ].forEach((l) => paragrafo(doc, l));

  seccao(doc, "Presenças");
  tabela(
    doc,
    [{ titulo: "Fração", largura: 70 }, { titulo: "Proprietário(s)", largura: 205 }, { titulo: "Permilagem", largura: 70, alinhar: "right" }, { titulo: "Presente / Representado", largura: 150 }],
    m.linhas.map((l) => [l.identificacao, l.proprietarios.join(", ") || "—", `${perm(l.permilagem)} ‰`, ""]),
  );
  paragrafo(doc, "Total da permilagem presente ou representada: ________ ‰ (quórum constituído: sim / não).", { tamanho: 9 });

  seccao(doc, `Ponto 1 · Contas de ${m.ano - 1}`);
  paragrafo(doc, "Foram apresentadas as contas e o relatório do administrador. Deliberação: ______________________________________________", { tamanho: 9 });

  seccao(doc, `Ponto 2 · Contribuições para ${m.ano}`);
  paragrafo(
    doc,
    opcoes.modo === "fixa"
      ? `A assembleia deliberou que a quota mensal é igual para todas as frações. Cada fração contribui, em ${m.ano}, com os montantes indicados, incluindo ${opcoes.fundoReservaPct.toLocaleString("pt-PT")} % para o fundo comum de reserva:`
      : `A assembleia deliberou repartir as contribuições pela permilagem de cada fração. Cada fração contribui, em ${m.ano}, com os montantes indicados, incluindo ${opcoes.fundoReservaPct.toLocaleString("pt-PT")} % para o fundo comum de reserva:`,
    { alinhar: "justify" },
  );
  tabela(
    doc,
    [
      { titulo: "Fração", largura: 70 },
      { titulo: "Permilagem", largura: 75, alinhar: "right" },
      { titulo: "Quota mensal", largura: 100, alinhar: "right" },
      { titulo: "Montante anual", largura: 130, alinhar: "right" },
      { titulo: "Fundo de reserva", largura: 120, alinhar: "right" },
    ],
    [
      ...m.linhas.map((l) => [l.identificacao, `${perm(l.permilagem)} ‰`, e(l.quotaMensalCent), e(l.montanteAnualCent), e(l.fundoReservaAnualCent)]),
      ["Total", "", "", e(m.totalAnualCent), e(m.totalFundoCent)],
    ],
    { totais: true },
  );
  garantirEspaco(doc, 120);
  paragrafo(doc, "As contribuições vencem-se nas seguintes datas:", { negrito: true, tamanho: 10 });
  paragrafo(doc, m.vencimentos.map((d) => formatarData(d)).join("  ·  "), { tamanho: 9 });
  paragrafo(doc, "Deliberação: aprovado por unanimidade / maioria de ________ ‰ do capital investido, com ________ ‰ de votos contra e ________ ‰ de abstenções.", { tamanho: 9 });

  seccao(doc, "Ponto 3 · Administrador");
  paragrafo(doc, "Foi eleito administrador: ______________________________________________, pelo período de ______ , com os votos de ________ ‰.", { tamanho: 9 });

  seccao(doc, "Ponto 4 · Outros assuntos");
  paragrafo(doc, "______________________________________________________________________________________________", { tamanho: 9 });
  paragrafo(doc, "______________________________________________________________________________________________", { tamanho: 9 });

  garantirEspaco(doc, 170);
  paragrafo(doc, "Nada mais havendo a tratar, foi encerrada a reunião pelas ____ horas, lavrando-se a presente ata, que vai ser assinada.");
  const y = doc.y + 50;
  assinatura(doc, "O Presidente da mesa", MARGEM, y, 200);
  assinatura(doc, "O Secretário", doc.page.width - MARGEM - 200, y, 200);
  doc.y = y + 30;
  paragrafo(doc, "Modelo para preencher. O quórum, as maiorias e as formalidades de convocação devem ser confirmados nos termos da lei (Código Civil e Lei n.º 8/2022).", { tamanho: 8, cor: "#4A5568" });
  return terminar(doc);
}
