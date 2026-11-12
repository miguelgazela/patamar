"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatarData, nomeDoMes } from "@/lib/datas";
import { decodificar } from "@/lib/extrato/csv";
import { detetarCabecalho, lerCsv, lerMovimentos, mapeamentoAuto, type Mapeamento } from "@/lib/extrato/parse";
import { preverAlocacoes, sugerir, type Confianca, type FracaoInfo, type Historico } from "@/lib/extrato/sugerir";
import { formatarEuros } from "@/lib/money";
import { guardarMapeamentoAction, importarAction, type ResultadoImportacao } from "./actions";

interface Props {
  fracoes: FracaoInfo[];
  historico: Historico[];
  chavesExistentes: string[];
  mapeamentoGuardado: Mapeamento | null;
}

const classeCampo = "w-full rounded-md border border-line bg-surface px-3 py-2 text-base";
const BADGES: Record<Confianca, { texto: string; classe: string }> = {
  alta: { texto: "Sugestão forte", classe: "bg-ok-bg text-ok-ink" },
  media: { texto: "Sugestão", classe: "bg-warn-bg text-warn-ink" },
  baixa: { texto: "Palpite fraco", classe: "bg-surface-2 text-muted" },
  nenhuma: { texto: "Sem sugestão", classe: "bg-surface-2 text-muted" },
};

async function lerFicheiro(f: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(f.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const folha = await readSheet(f); // primeira folha
    return folha
      .map((l) => l.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c === null || c === undefined ? "" : String(c)).trim()))
      .filter((l) => l.some((c) => c !== ""));
  }
  if (/\.xls$/i.test(f.name)) throw new Error("Ficheiros .xls antigos não são suportados. Guarde como .xlsx ou .csv.");
  return lerCsv(decodificar(await f.arrayBuffer()));
}

function mapeamentoCabe(m: Mapeamento | null, cab: string[]): m is Mapeamento {
  if (!m) return false;
  const tem = (n?: string) => !!n && cab.includes(n);
  if (!tem(m.data) || !tem(m.descricao)) return false;
  return m.modo === "valor" ? tem(m.valor) : tem(m.credito) || tem(m.debito);
}

export function Importador({ fracoes, historico, chavesExistentes, mapeamentoGuardado }: Props) {
  const [ficheiro, setFicheiro] = useState<{ nome: string; linhas: string[][] } | null>(null);
  const [erroFicheiro, setErroFicheiro] = useState<string | null>(null);
  const [cabIdx, setCabIdx] = useState(0);
  const [mapeamento, setMapeamento] = useState<Mapeamento | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, { fracaoId: string; incluir: boolean }>>({});
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [aCorrer, iniciar] = useTransition();

  const cab = useMemo(() => ficheiro?.linhas[cabIdx] ?? [], [ficheiro, cabIdx]);
  const mapeamentoOk = mapeamentoCabe(mapeamento, cab);

  function definirFicheiro(nome: string, linhas: string[][]) {
    const idx = detetarCabecalho(linhas);
    const c = linhas[idx] ?? [];
    setFicheiro({ nome, linhas });
    setCabIdx(idx);
    setMapeamento(mapeamentoCabe(mapeamentoGuardado, c) ? mapeamentoGuardado : mapeamentoAuto(c));
    setEscolhas({});
    setResultado(null);
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErroFicheiro(null);
    try {
      const linhas = await lerFicheiro(f);
      if (linhas.length < 2) throw new Error("O ficheiro parece vazio.");
      definirFicheiro(f.name, linhas);
    } catch (err) {
      setFicheiro(null);
      setErroFicheiro(err instanceof Error ? err.message : "Não foi possível ler o ficheiro.");
    }
  }

  function mudarCabecalho(i: number) {
    if (!ficheiro) return;
    const c = ficheiro.linhas[i] ?? [];
    setCabIdx(i);
    setMapeamento(mapeamentoCabe(mapeamentoGuardado, c) ? mapeamentoGuardado : mapeamentoAuto(c));
    setEscolhas({});
  }

  const leitura = useMemo(
    () => (ficheiro && mapeamentoOk ? lerMovimentos(ficheiro.linhas, cabIdx, mapeamento) : null),
    [ficheiro, mapeamentoOk, cabIdx, mapeamento],
  );
  const existentes = useMemo(() => new Set(chavesExistentes), [chavesExistentes]);

  const linhas = useMemo(() => {
    if (!leitura) return [];
    return leitura.movimentos.map((m) => {
      const sug = sugerir(m, fracoes, historico);
      const duplicado = existentes.has(m.chave);
      const esc = escolhas[m.chave];
      const fracaoId = esc?.fracaoId ?? sug.fracaoId ?? "";
      const sugerida = sug.confianca === "alta" || sug.confianca === "media";
      return { m, sug, duplicado, fracaoId, incluir: !duplicado && fracaoId !== "" && (esc ? esc.incluir : sugerida) };
    });
  }, [leitura, fracoes, historico, existentes, escolhas]);

  const previsoes = useMemo(
    () => preverAlocacoes(linhas.filter((l) => l.incluir).map((l) => ({ id: l.m.chave, fracaoId: l.fracaoId, valorCent: l.m.valorCent, data: l.m.data })), fracoes),
    [linhas, fracoes],
  );
  const registaveis = linhas.filter((l) => {
    const p = previsoes.get(l.m.chave);
    return l.incluir && p && p.alocadas.length > 0 && p.sobraCent === 0;
  });
  const totalCent = registaveis.reduce((a, l) => a + l.m.valorCent, 0);

  function confirmar() {
    iniciar(async () => {
      const r = await importarAction(registaveis.map((l) => ({ data: l.m.data, valorCent: l.m.valorCent, descricao: l.m.descricao, chave: l.m.chave, fracaoId: l.fracaoId })));
      setResultado(r);
      if (r.registados > 0 && mapeamento && JSON.stringify(mapeamento) !== JSON.stringify(mapeamentoGuardado)) await guardarMapeamentoAction(mapeamento);
    });
  }

  const opcoes = (atual: string, vazio = "— nenhuma —") => (
    <>
      <option value="">{vazio}</option>
      {cab.map((c, i) => <option key={`${c}-${i}`} value={c} disabled={false}>{c || `(coluna ${i + 1})`}</option>)}
      {atual && !cab.includes(atual) && <option value={atual}>{atual}</option>}
    </>
  );
  const definir = (campo: keyof Mapeamento, valor: string) => setMapeamento((m) => ({ ...(m ?? { data: "", descricao: "", modo: "valor" }), [campo]: valor }) as Mapeamento);

  if (resultado && !aCorrer) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Importação concluída</h2>
        <p className="text-ok-ink">{resultado.registados} {resultado.registados === 1 ? "pagamento registado" : "pagamentos registados"}.</p>
        {resultado.duplicados > 0 && <p className="text-muted">{resultado.duplicados} já tinham sido importados e foram ignorados.</p>}
        {resultado.erroGeral && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{resultado.erroGeral}</p>}
        {resultado.erros.length > 0 && (
          <ul className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">
            {resultado.erros.map((e) => <li key={e.chave}>{e.chave.split("|")[2] || e.chave}: {e.mensagem}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href="/quotas" className="min-h-11 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand">Ver quotas</Link>
          <button onClick={() => { setResultado(null); setFicheiro(null); }} className="min-h-11 rounded-md border border-brand px-4 py-3 font-semibold text-brand">Importar outro ficheiro</button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line bg-surface p-4 text-center">
        <span className="font-medium text-brand">{ficheiro ? `Ficheiro: ${ficheiro.nome}` : "Escolher o extrato (CSV ou Excel)"}</span>
        <span className="text-xs text-muted">Exportado do homebanking. Fica no seu dispositivo até confirmar os pagamentos.</span>
        <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={aoEscolher} className="sr-only" />
      </label>
      {erroFicheiro && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{erroFicheiro}</p>}

      {ficheiro && (
        <details className="rounded-lg border border-line bg-surface p-4" open={!mapeamentoOk}>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand">Colunas do ficheiro {mapeamentoOk ? "(reconhecidas)" : "(escolha-as)"}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Linha do cabeçalho
              <input type="number" min={1} max={Math.min(30, ficheiro.linhas.length)} value={cabIdx + 1} onChange={(e) => mudarCabecalho(Math.max(0, Number(e.target.value) - 1))} className={classeCampo} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Data
              <select value={mapeamento?.data ?? ""} onChange={(e) => definir("data", e.target.value)} className={classeCampo}>{opcoes(mapeamento?.data ?? "", "— escolher —")}</select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Descrição
              <select value={mapeamento?.descricao ?? ""} onChange={(e) => definir("descricao", e.target.value)} className={classeCampo}>{opcoes(mapeamento?.descricao ?? "", "— escolher —")}</select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Valores em
              <select value={mapeamento?.modo ?? "valor"} onChange={(e) => definir("modo", e.target.value)} className={classeCampo}>
                <option value="valor">Uma coluna com sinal (+/−)</option>
                <option value="credito_debito">Colunas de crédito e débito</option>
              </select>
            </label>
            {(mapeamento?.modo ?? "valor") === "valor" ? (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Valor
                <select value={mapeamento?.valor ?? ""} onChange={(e) => definir("valor", e.target.value)} className={classeCampo}>{opcoes(mapeamento?.valor ?? "", "— escolher —")}</select>
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Crédito (entradas)
                  <select value={mapeamento?.credito ?? ""} onChange={(e) => definir("credito", e.target.value)} className={classeCampo}>{opcoes(mapeamento?.credito ?? "", "— escolher —")}</select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Débito (saídas)
                  <select value={mapeamento?.debito ?? ""} onChange={(e) => definir("debito", e.target.value)} className={classeCampo}>{opcoes(mapeamento?.debito ?? "")}</select>
                </label>
              </>
            )}
          </div>
        </details>
      )}

      {leitura && (
        <>
          <p className="text-sm text-muted">
            {leitura.movimentos.length} {leitura.movimentos.length === 1 ? "entrada" : "entradas"} de dinheiro
            {leitura.semEntrada > 0 && ` · ${leitura.semEntrada} saídas ignoradas`}
            {leitura.invalidas > 0 && ` · ${leitura.invalidas} linhas ilegíveis ignoradas`}
          </p>
          {leitura.movimentos.length === 0 && <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-ink">Não encontrámos entradas. Confirme as colunas acima.</p>}

          <ul className="flex flex-col gap-3">
            {linhas.map((l) => {
              const prev = previsoes.get(l.m.chave);
              const b = BADGES[l.sug.confianca];
              const excede = l.incluir && prev && prev.sobraCent > 0;
              return (
                <li key={l.m.chave} className={`rounded-lg border bg-surface p-4 ${l.duplicado ? "border-line opacity-60" : "border-line"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{formatarEuros(l.m.valorCent)} <span className="font-normal text-muted">· {formatarData(l.m.data)}</span></p>
                      <p className="break-words text-sm text-muted">{l.m.descricao || "(sem descrição)"}</p>
                    </div>
                    {l.duplicado ? (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">Já importado</span>
                    ) : (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${b.classe}`}>{b.texto}</span>
                    )}
                  </div>
                  {!l.duplicado && (
                    <div className="mt-3 flex flex-col gap-2">
                      <label className="flex flex-col gap-1 text-sm font-medium">
                        Fração
                        <select
                          value={l.fracaoId}
                          onChange={(e) => setEscolhas((s) => ({ ...s, [l.m.chave]: { fracaoId: e.target.value, incluir: e.target.value !== "" } }))}
                          className={classeCampo}
                        >
                          <option value="">— escolher —</option>
                          {fracoes.map((f) => <option key={f.id} value={f.id}>{f.identificacao}{f.proprietarios.length ? ` · ${f.proprietarios.join(", ")}` : ""}</option>)}
                        </select>
                      </label>
                      {l.sug.motivos.length > 0 && l.fracaoId === l.sug.fracaoId && <p className="text-xs text-muted">{l.sug.motivos.join(" · ")}</p>}
                      {l.incluir && prev && prev.alocadas.length > 0 && (
                        <p className="text-sm">Paga: {prev.alocadas.map((a) => `${nomeDoMes(a.mes)}${a.valorCent < 0 ? "" : ` (${formatarEuros(a.valorCent)})`}`).join(", ")}</p>
                      )}
                      {excede && <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-ink">{prev!.alocadas.length === 0 ? "Esta fração não tem quotas por pagar." : `Excede em ${formatarEuros(prev!.sobraCent)} o que está por pagar. Não será registado.`}</p>}
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={l.incluir}
                          disabled={l.fracaoId === ""}
                          onChange={(e) => setEscolhas((s) => ({ ...s, [l.m.chave]: { fracaoId: l.fracaoId, incluir: e.target.checked } }))}
                          className="size-5"
                        />
                        Registar este pagamento
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {linhas.length > 0 && (
            <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-paper px-4 py-3">
              <button disabled={aCorrer || registaveis.length === 0} onClick={confirmar} className="min-h-12 rounded-md bg-brand px-4 py-3 font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
                {aCorrer ? "A registar…" : registaveis.length === 0 ? "Nenhum pagamento selecionado" : `Registar ${registaveis.length} ${registaveis.length === 1 ? "pagamento" : "pagamentos"} (${formatarEuros(totalCent)})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
