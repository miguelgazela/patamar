import "server-only";
import { lerTodas } from "@/lib/supabase/todas";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Tabelas exportadas e a ordenação estável usada na paginação. A RLS decide o que cada utilizador vê. */
const TABELAS: { nome: string; ordem: string[] }[] = [
  { nome: "condominios", ordem: ["id"] },
  { nome: "fracoes", ordem: ["id"] },
  { nome: "anexos", ordem: ["id"] },
  { nome: "pessoas", ordem: ["id"] },
  { nome: "propriedades", ordem: ["pessoa_id", "fracao_id"] },
  { nome: "administracoes", ordem: ["id"] },
  { nome: "quotas", ordem: ["id"] },
  { nome: "pagamentos", ordem: ["id"] },
  { nome: "pagamento_quotas", ordem: ["pagamento_id", "quota_id"] },
  { nome: "despesas", ordem: ["id"] },
  { nome: "documentos", ordem: ["id"] },
  { nome: "lembretes", ordem: ["id"] },
  { nome: "registo_atividade", ordem: ["id"] },
];

export interface Exportacao {
  exportado_em: string;
  formato: string;
  perfil: "administrador" | "condomino";
  dados: Record<string, unknown[]>;
}

/** Cópia dos dados a que o utilizador tem acesso (direito de acesso e portabilidade, RGPD art. 15.º e 20.º). */
export async function exportarDados(perfil: "administrador" | "condomino"): Promise<Exportacao> {
  const sb = await criarClienteServidor();
  const dados: Record<string, unknown[]> = {};
  for (const t of TABELAS) {
    const r = await lerTodas<Record<string, unknown>>(() => {
      let q = sb.from(t.nome).select("*");
      for (const o of t.ordem) q = q.order(o);
      return q;
    });
    if (r.error) throw new Error(`Falha a exportar ${t.nome}`);
    // O identificador interno de autenticação não é um dado útil nem portável.
    dados[t.nome] = t.nome === "pessoas" ? r.data.map(({ auth_user_id: _omitido, ...resto }) => (void _omitido, resto)) : r.data;
  }
  return { exportado_em: new Date().toISOString(), formato: "patamar-exportacao-v1", perfil, dados };
}
