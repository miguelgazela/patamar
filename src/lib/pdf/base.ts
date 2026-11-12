import PDFDocument from "pdfkit";
import { formatarData, type Data } from "../datas";

export type Doc = InstanceType<typeof PDFDocument>;

const AZUL = "#1D4E89";
const CINZA = "#4A5568";
const LINHA = "#CFC6B5";
const FUNDO = "#F3EEE6";
export const MARGEM = 56;

/** Nota de rodapé em todas as páginas. */
const RODAPE = "Documento gerado pela plataforma Patamar com os dados registados à data de emissão.";

export function novoDocumento(titulo: string): Doc {
  return new PDFDocument({ size: "A4", margin: MARGEM, bufferPages: true, info: { Title: titulo, Author: "Patamar", Creator: "Patamar" } });
}

/** Termina o documento (com rodapés e numeração) e devolve os bytes. */
export function terminar(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on("data", (p: Buffer) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    const { count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - 40;
      doc.page.margins.bottom = 0; // evita nova página ao escrever no rodapé
      doc.font("Helvetica").fontSize(8).fillColor(CINZA);
      doc.text(RODAPE, MARGEM, y, { width: doc.page.width - 2 * MARGEM - 70, lineBreak: false });
      doc.text(`Página ${i + 1} de ${count}`, doc.page.width - MARGEM - 70, y, { width: 70, align: "right", lineBreak: false });
    }
    doc.end();
  });
}

export function cabecalho(doc: Doc, condominio: { nome: string; morada: string; nif: string | null }, titulo: string, subtitulo?: string) {
  doc.font("Helvetica-Bold").fontSize(15).fillColor(AZUL).text(condominio.nome, MARGEM, MARGEM);
  doc.font("Helvetica").fontSize(9).fillColor(CINZA).text(`${condominio.morada}${condominio.nif ? ` · NIF ${condominio.nif}` : ""}`);
  doc.moveDown(0.4);
  const y = doc.y;
  doc.moveTo(MARGEM, y).lineTo(doc.page.width - MARGEM, y).lineWidth(2).strokeColor(AZUL).stroke();
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#1B2433").text(titulo);
  if (subtitulo) doc.font("Helvetica").fontSize(10).fillColor(CINZA).text(subtitulo);
  doc.moveDown(0.8);
  doc.fillColor("#1B2433");
}

/** `altura`: espaço mínimo que o título e o início do conteúdo precisam, para não ficarem separados por uma quebra de página. */
export function seccao(doc: Doc, titulo: string, altura = 130) {
  garantirEspaco(doc, altura);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(AZUL).text(titulo, MARGEM);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor("#1B2433");
}

export function paragrafo(doc: Doc, texto: string, opcoes: { negrito?: boolean; tamanho?: number; cor?: string; alinhar?: "left" | "right" | "center" | "justify" } = {}) {
  doc.font(opcoes.negrito ? "Helvetica-Bold" : "Helvetica").fontSize(opcoes.tamanho ?? 10).fillColor(opcoes.cor ?? "#1B2433");
  doc.text(limpar(texto), MARGEM, doc.y, { width: doc.page.width - 2 * MARGEM, align: opcoes.alinhar ?? "left", lineGap: 2 });
  doc.moveDown(0.4);
}

/** Espaços não separáveis (p. ex. em «1 234,56 €») fazem o texto colar-se ao símbolo nas fontes padrão do PDF. */
const limpar = (t: string) => t.replace(/\u00a0/g, " ");

export function garantirEspaco(doc: Doc, altura: number) {
  if (doc.y + altura > doc.page.height - MARGEM - 30) doc.addPage();
}

export interface Coluna {
  titulo: string;
  largura: number;
  alinhar?: "left" | "right" | "center";
}

/** Tabela simples com cabeçalho repetido nas quebras de página. A última linha pode ir a negrito (totais). */
export function tabela(doc: Doc, colunas: Coluna[], linhas: string[][], opcoes: { totais?: boolean } = {}) {
  const x0 = MARGEM;
  const larguraTotal = colunas.reduce((a, c) => a + c.largura, 0);
  const limite = () => doc.page.height - MARGEM - 30;

  const desenharCabecalho = () => {
    const y = doc.y;
    doc.rect(x0, y, larguraTotal, 20).fill(FUNDO);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1B2433");
    let x = x0;
    for (const c of colunas) {
      doc.text(c.titulo, x + 4, y + 6, { width: c.largura - 8, align: c.alinhar ?? "left", lineBreak: false });
      x += c.largura;
    }
    doc.y = y + 20;
  };

  desenharCabecalho();
  linhas.forEach((linha, i) => {
    const ultimaTotal = opcoes.totais && i === linhas.length - 1;
    doc.font(ultimaTotal ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    const h = Math.max(...linha.map((c, j) => doc.heightOfString(limpar(c), { width: colunas[j].largura - 8 }))) + 8;
    if (doc.y + h > limite()) {
      doc.addPage();
      desenharCabecalho();
      doc.font(ultimaTotal ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    }
    const y = doc.y;
    let x = x0;
    doc.fillColor("#1B2433");
    linha.forEach((c, j) => {
      doc.text(limpar(c), x + 4, y + 4, { width: colunas[j].largura - 8, align: colunas[j].alinhar ?? "left" });
      x += colunas[j].largura;
    });
    doc.moveTo(x0, y + h).lineTo(x0 + larguraTotal, y + h).lineWidth(ultimaTotal ? 1 : 0.5).strokeColor(ultimaTotal ? AZUL : LINHA).stroke();
    doc.y = y + h;
  });
  doc.x = MARGEM;
  doc.moveDown(0.5);
  doc.fillColor("#1B2433");
}

/** Linha para assinatura. */
export function assinatura(doc: Doc, legenda: string, x: number, y: number, largura = 200) {
  doc.moveTo(x, y).lineTo(x + largura, y).lineWidth(0.7).strokeColor("#1B2433").stroke();
  doc.font("Helvetica").fontSize(9).fillColor(CINZA).text(legenda, x, y + 4, { width: largura, align: "center" });
  doc.fillColor("#1B2433");
}

export const dataExtenso = (d: Data) => formatarData(d);
