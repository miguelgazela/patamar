/**
 * O PostgREST devolve no máximo 1000 linhas por pedido (max_rows). Para tabelas que crescem
 * (quotas, pagamentos por quota, despesas), lê todas as páginas. A consulta TEM de ter ordenação estável.
 * Devolve o mesmo formato `{ data, error }` do cliente Supabase.
 */
type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function lerTodas<T = Record<string, unknown>>(
  construir: () => { range: (de: number, ate: number) => Pagina<T> },
  tamanho = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await construir().range(de, de + tamanho - 1);
    if (error) return { data: [], error };
    out.push(...(data ?? []));
    if (!data || data.length < tamanho) return { data: out, error: null };
  }
}
