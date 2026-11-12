import { formatarData } from "../datas";
import type { Declaracao } from "../documentos/declaracao";
import { ROTULOS_TIPO, type TipoFracao } from "../fracoes";
import { formatarEuros } from "../money";
import { assinatura, cabecalho, novoDocumento, paragrafo, seccao, tabela, terminar, MARGEM } from "./base";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mes = (m: string) => `${cap(NOMES_MES[Number(m.slice(5, 7)) - 1])} de ${m.slice(0, 4)}`;

export function gerarDeclaracaoPdf(d: Declaracao): Promise<Buffer> {
  const doc = novoDocumento(`Declaração de encargos · ${d.fracao.identificacao} · ${d.condominio.nome}`);
  const e = formatarEuros;
  const f = d.fracao;

  cabecalho(doc, d.condominio, "Declaração de encargos e dívidas de fração", `Emitida a ${formatarData(d.hoje)}`);

  paragrafo(
    doc,
    `Para os devidos efeitos, o Administrador do ${d.condominio.nome} declara que a fração autónoma designada por «${f.identificacao}» (${(ROTULOS_TIPO[f.tipo as TipoFracao] ?? f.tipo).toLowerCase()}, permilagem de ${f.permilagem.toLocaleString("pt-PT", { maximumFractionDigits: 3 })} ‰)${f.anexos.length ? `, com os anexos ${f.anexos.join(", ")},` : ""} do prédio sito em ${d.condominio.morada}, ${f.proprietarios.length ? `registada em nome de ${f.proprietarios.join(" e ")}, ` : ""}apresenta, à data de ${formatarData(d.hoje)}, a seguinte situação perante o condomínio:`,
    { alinhar: "justify" },
  );

  seccao(doc, "Encargos ordinários");
  tabela(
    doc,
    [{ titulo: "", largura: 340 }, { titulo: "Valor", largura: 155, alinhar: "right" }],
    [
      ["Quota mensal ordinária em vigor", e(d.quotaMensalCent)],
      ["Encargos anuais ordinários (12 quotas)", e(d.encargosAnuaisOrdinariosCent)],
      [`Dos quais para o fundo comum de reserva (${d.fundoReservaPct.toLocaleString("pt-PT")} %)`, e(d.fundoReservaAnualCent)],
    ],
  );

  seccao(doc, "Quotas em dívida");
  if (d.quotasEmDivida.length === 0) paragrafo(doc, "À data de emissão não existem quotas vencidas por pagar.");
  else {
    tabela(
      doc,
      [{ titulo: "Quota", largura: 200 }, { titulo: "Vencimento", largura: 140 }, { titulo: "Em dívida", largura: 155, alinhar: "right" }],
      [...d.quotasEmDivida.map((q) => [mes(q.mes), formatarData(q.dataLimite), e(q.restanteCent)]), ["Total em dívida", "", e(d.totalEmDividaCent)]],
      { totais: true },
    );
  }

  seccao(doc, "Outros encargos e situações (a completar pelo Administrador)");
  paragrafo(doc, "Obras aprovadas em assembleia e respetivas quotas-partes por pagar: ______________________________________________", { tamanho: 9 });
  paragrafo(doc, "Ações judiciais pendentes relativas a dívidas desta fração: ______________________________________________", { tamanho: 9 });

  doc.moveDown(1);
  paragrafo(doc, "Por ser verdade, vai a presente declaração assinada.");
  doc.moveDown(1.5);
  paragrafo(doc, "____________________, ___ de ______________ de ________", { tamanho: 9 });
  assinatura(doc, `${d.administrador.nome}, Administrador`, MARGEM, doc.y + 50, 240);
  return terminar(doc);
}
