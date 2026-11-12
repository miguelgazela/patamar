# Lançamento do Patamar

Guia para pôr a v1 em produção e começar o piloto no prédio do dono do projeto. Os passos marcados com ⚠️ precisam de decisão ou de conta vossa; o resto está pronto no repositório.

## 1. Decisões a tomar antes de começar

| Decisão | Sugestão | Porque importa |
| --- | --- | --- |
| Alojamento da app | Vercel, região `fra1` (Frankfurt), já configurado em `vercel.json` | RGPD: dados na UE. O cron diário dos lembretes também está em `vercel.json` |
| Projeto Supabase | Região UE (Frankfurt ou Irlanda) | Base de dados, autenticação e ficheiros |
| Domínio | Um `.pt` ou `.app` (falta verificar disponibilidade e marca no INPI, ver `CLAUDE.md`) | Resend exige domínio verificado para o remetente |
| Entidade que presta o serviço | Nome, NIF, morada e email de privacidade | Entra em `/privacidade` e `/termos` (`src/lib/legal.ts`) |
| Preço | 6 a 9 € por mês por prédio (a validar) | Ainda não há cobrança na app; para o piloto não é preciso |

## 2. Infraestrutura (por esta ordem)

1. **Supabase (nuvem).**
   - Criar o projeto na região UE.
   - `supabase link --project-ref <ref>` e depois `supabase db push` para aplicar as migrações. **Não** aplicar o `seed.sql` (tem utilizadores fictícios).
   - Authentication → URL Configuration: `Site URL` = URL público da app; `Redirect URLs` com o mesmo URL.
   - Authentication → Providers → Email: ativo, **sem** confirmação por link; validade do código 600 s; registos abertos (`/comecar` precisa deles).
   - Authentication → Email Templates: colar o conteúdo de `supabase/templates/codigo.html` nos modelos *Magic Link* e *Confirm signup*, com o assunto «O seu código de acesso ao Patamar».
   - Authentication → SMTP: usar o SMTP do Resend, porque o serviço de email incluído no Supabase tem um limite muito baixo.
   - Authentication → Attack Protection: **ligar o captcha** (Cloudflare Turnstile ou hCaptcha) e rever os limites de envio e de verificação. Sem captcha, o formulário de `/comecar` pode ser abusado para enviar emails.
   - Storage: os buckets `faturas` e `documentos` são criados pelas migrações. Confirmar que estão privados.
   - Database → Backups: ativar cópias diárias (e PITR, se o plano o permitir).
2. **Resend.** Verificar o domínio (registos SPF, DKIM e DMARC no DNS), região UE, criar a chave de API.
3. **Anthropic (opcional).** Chave de API para a leitura de faturas. Confirmar a região de tratamento e o acordo de tratamento de dados e refleti-los em `src/lib/legal.ts`.
4. **Vercel.** Importar o projeto, definir as variáveis de ambiente (abaixo), ligar o domínio. O cron de `vercel.json` envia o `CRON_SECRET` como `Authorization: Bearer`, que é o que `/api/cron/lembretes` espera.

## 3. Variáveis de ambiente de produção

Ver `.env.example`. Obrigatórias em produção (a verificação `/api/saude` falha se faltarem ou estiverem mal):

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (https), `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (≥ 24 caracteres aleatórios).

Não definir `EMAIL_DEV_URL` em produção. `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL` são opcionais. A chave `SUPABASE_SERVICE_ROLE_KEY` nunca vai para o browser nem para o repositório.

## 4. Textos legais ⚠️

- [ ] Preencher `ENTIDADE` e os `[confirmar ...]` em `src/lib/legal.ts`.
- [ ] Jurista a rever `/privacidade`, `/termos`, o aviso de atraso (`src/lib/lembretes.ts`) e os PDFs (declaração de encargos, ata, relatório). O `CLAUDE.md` já exige esta revisão.
- [ ] Contratos de tratamento de dados (DPA) com Supabase, Resend, Anthropic e o alojamento.
- [ ] Decidir prazos de conservação e se é preciso purgar `registo_atividade` e `lembretes` por idade.
- [ ] Decidir se os condóminos convidados têm de aceitar os termos na primeira entrada.

## 5. Antes de abrir ao público

- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` sem erros.
- [ ] `GET /api/saude` devolve `{"ok":true}` na produção.
- [ ] Teste de fumo (ver abaixo) feito de ponta a ponta no ambiente de produção.
- [ ] Captcha ligado e limites de envio revistos no Supabase.
- [ ] Monitorização do endpoint `/api/saude` (por exemplo UptimeRobot) e alertas de erro (Sentry com região UE, se quiserem).
- [ ] Repositório Git criado e protegido (hoje a pasta não é um repositório Git).
- [ ] Rotacionar quaisquer chaves usadas em desenvolvimento.

### Teste de fumo (15 minutos)

1. `/comecar` com um email real: aceitar os termos, receber o código, entrar, criar um condomínio de teste com 3 frações.
2. Definições: IBAN válido. Gerar as quotas do mês.
3. Convidar um segundo email como condómino; entrar com ele e confirmar que vê só os seus dados.
4. Registar um pagamento manual; importar um extrato de teste; confirmar que as quotas passam a pagas.
5. Fotografar uma fatura (com `ANTHROPIC_API_KEY`) e confirmar que os campos são propostos.
6. Enviar um lembrete de atraso a um email vosso e ver o aspeto no telemóvel e no Gmail.
7. Documentos: gerar e publicar o relatório e a ata; descarregar como condómino.
8. Exportar os dados e eliminar o condomínio de teste.

## 6. O piloto (prédio do dono do projeto)

1. Criar o condomínio e as 5 frações reais (permilagens, anexos, proprietários com emails reais).
2. `Quotas → Migrar do Excel`: período desde janeiro do ano atual; escrever o total pago por fração. Registar as despesas do período (por fotografia).
3. Convidar os condóminos e explicar o código por email.
4. Usar durante 2 a 3 meses. Critério de sucesso da v1: deixar de abrir o Excel.
5. Anotar o que falta (ver backlog) e pedir ao dono um extrato real, com nomes trocados, para afinar a importação.

## 7. Limites conhecidos da v1

- Excedente de pagamentos (acima da dívida) é recusado; não há crédito.
- Despesas recorrentes são só uma marcação; não geram despesas.
- Não há edição nem anulação de despesas e pagamentos já registados.
- Não há transferência do cargo para o «administrador seguinte».
- O saldo de abertura (migração) não inclui despesas históricas nem saldo anterior do fundo de reserva.
- O fundo de reserva pode divergir 1 cêntimo em pagamentos parciais.
- Um condomínio de fachada consegue enviar emails com o remetente oficial (limitado a 60 lembretes e 40 convites por dia). O captcha reduz o risco; considerar aprovação manual de novos condomínios.
- O Storage de documentos não restringe por fração (só relevante se um dia se guardarem declarações lá).
- O serviço de email e a Anthropic têm de estar em região UE ou com garantias adequadas.
