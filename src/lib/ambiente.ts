export interface VerificacaoAmbiente {
  ok: boolean;
  /** Variáveis obrigatórias em falta ou inválidas. */
  faltam: string[];
  /** Situações a corrigir, mas que não impedem o arranque. */
  avisos: string[];
}

type Env = Record<string, string | undefined>;

/** Confirma que a configuração de produção está completa e coerente (por exemplo, sem o Mailpit de desenvolvimento). */
export function verificarAmbiente(env: Env, producao: boolean): VerificacaoAmbiente {
  const faltam: string[] = [];
  const avisos: string[] = [];
  const tem = (k: string) => !!env[k]?.trim();

  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) if (!tem(k)) faltam.push(k);

  if (producao) {
    const url = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
    if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) faltam.push("NEXT_PUBLIC_APP_URL (https, não local)");
    if (/127\.0\.0\.1|localhost/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) faltam.push("NEXT_PUBLIC_SUPABASE_URL (aponta para o Supabase local)");
    for (const k of ["RESEND_API_KEY", "EMAIL_FROM", "CRON_SECRET"]) if (!tem(k)) faltam.push(k);
    if ((env.CRON_SECRET ?? "").length > 0 && (env.CRON_SECRET ?? "").length < 24) faltam.push("CRON_SECRET (mínimo 24 caracteres)");
    if (tem("EMAIL_DEV_URL")) avisos.push("EMAIL_DEV_URL está definido em produção (deve estar vazio)");
    if (!tem("ANTHROPIC_API_KEY")) avisos.push("Sem ANTHROPIC_API_KEY: a leitura de faturas por fotografia fica desligada");
  }
  return { ok: faltam.length === 0, faltam, avisos };
}
