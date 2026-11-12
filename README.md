# Patamar

App web (PWA) para gerir o condomínio de prédios autogeridos em Portugal: quotas, despesas por fotografia, extrato bancário, lembretes de atraso, portal do condómino e documentos em PDF. Contexto, âmbito e convenções em [CLAUDE.md](CLAUDE.md).

## Requisitos

- Node 24 e npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) e Docker (base de dados, autenticação e Storage locais)

## Arrancar em desenvolvimento

```bash
cp .env.example .env.local        # preencher as chaves locais com `supabase status`
supabase start -x studio,imgproxy,edge-runtime,vector,logflare,realtime,postgres-meta
supabase db reset                 # aplica as migrações e o seed (prédio fictício)
npm install
npm run dev                       # http://localhost:3000
```

- Os emails (códigos de acesso, convites, lembretes) chegam ao Mailpit: http://127.0.0.1:54324
- Utilizadores do seed (entram por código de email): `rita.mendes@example.com` (administradora), `carlos.pereira@example.com`, `paulo.ferreira@example.com` (condóminos).
- Para ler faturas por fotografia, defina `ANTHROPIC_API_KEY` em `.env.local`. Sem ela, a despesa preenche-se à mão.

## Verificações

```bash
npm test          # Vitest: cálculos de quotas, saldos, extrato, lembretes, PDFs
npm run lint
npm run typecheck
npm run build
```

Testes de integração contra o Supabase local (migração do Excel): `RODAR_INTEGRACAO=1 SUPABASE_SERVICE_ROLE_KEY=<chave do supabase status> npm test`.

Se o Vitest falhar com «Cannot find native binding» depois de instalar pacotes (bug do npm com dependências opcionais), instale o binding da sua plataforma sem o gravar: `npm i --no-save @rolldown/binding-darwin-arm64@<versão do rolldown>`.

## Envio automático de lembretes

`GET /api/cron/lembretes` com `Authorization: Bearer $CRON_SECRET`, uma vez por dia, a partir de um cron externo (Vercel Cron, GitHub Actions, cron do servidor). Só trata condomínios com envio automático ligado.

## Produção (antes de lançar)

- Alojar app e base de dados na União Europeia (Supabase UE, alojamento UE).
- Email transacional: Resend com domínio verificado (`RESEND_API_KEY`, `EMAIL_FROM`). Em produção, `NEXT_PUBLIC_APP_URL` é obrigatório.
- Autenticação: ativar captcha e rever os limites de envio e de verificação do projeto Supabase.
- Rever com um jurista os modelos de PDF e os textos dos avisos; política de privacidade e termos (RGPD).
