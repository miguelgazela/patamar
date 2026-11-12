-- Seed de desenvolvimento: prédio de teste com dados FICTÍCIOS.
-- Nunca guardar dados reais de condóminos neste ficheiro.
--
-- Cenário (hoje = 09/11/2026):
--   * 5 frações de habitação, quota fixa 45,00 €/mês, fundo de reserva 10 %.
--   * Frações 1, 2, 3 pagas até novembro; fração 5 com novembro por pagar.
--   * Fração 4 (Paulo Ferreira) pagou 3 meses de uma vez em maio e deve agosto a novembro.
--   * Pessoa com 2 frações (Carlos: 2.º Esq. e 3.º Dto.) e fração com 2 proprietários (3.º Esq.).

-- Utilizadores de login de desenvolvimento (entram por código de email): Rita (administradora),
-- Carlos (2 frações) e Paulo (fração em atraso).
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-0000000000a1', 'rita.mendes@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'carlos.pereira@example.com'),
  ('00000000-0000-0000-0000-0000000000a5', 'paulo.ferreira@example.com')
) as u(id, email)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id::uuid, jsonb_build_object('sub', u.id, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from (values
  ('00000000-0000-0000-0000-0000000000a1', 'rita.mendes@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'carlos.pereira@example.com'),
  ('00000000-0000-0000-0000-0000000000a5', 'paulo.ferreira@example.com')
) as u(id, email)
on conflict do nothing;

insert into condominios (id, nome, morada, nif, iban, modo_quota, valor_quota_cent, fundo_reserva_pct, dia_vencimento)
values ('11111111-1111-1111-1111-111111111111', 'Condomínio Rua das Flores, 12', 'Rua das Flores, 12, 1000-001 Lisboa',
        '980000009', 'PT77' || repeat('0', 21), 'fixa', 4500, 10, 8);

insert into fracoes (id, condominio_id, identificacao, tipo, permilagem) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'R/C Esq.', 'habitacao', 180),
  ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '1.º Esq.',  'habitacao', 190),
  ('f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '1.º Dto.',  'habitacao', 200),
  ('f0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '2.º Esq.',  'habitacao', 210),
  ('f0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '2.º Dto.',  'habitacao', 220);

insert into anexos (condominio_id, fracao_id, tipo, identificacao) values
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 'box', 'Box 1'),
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000002', 'box', 'Box 2'),
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000004', 'box', 'Box 3'),
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 'arrecadacao', 'Arrecadação A'),
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000003', 'arrecadacao', 'Arrecadação B');

insert into pessoas (id, condominio_id, auth_user_id, nome, email, telemovel) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a1', 'Rita Mendes',   'rita.mendes@example.com',   '910000001'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a2', 'Carlos Pereira', 'carlos.pereira@example.com', '910000002'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', null, 'Helena Costa',   'helena.costa@example.com',   '910000003'),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', null, 'Jorge Costa',    'jorge.costa@example.com',    '910000004'),
  ('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a5', 'Paulo Ferreira', 'paulo.ferreira@example.com', '910000005');

insert into propriedades (pessoa_id, fracao_id, condominio_id) values
  ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111');

insert into administracoes (condominio_id, pessoa_id, inicio)
values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '2026-01-01');

-- Quotas de janeiro a novembro de 2026 (fundo de reserva = 10 % da quota).
insert into quotas (condominio_id, fracao_id, mes, valor_cent, fundo_reserva_cent, data_limite)
select c.id, f.id, m::date, c.valor_quota_cent, round(c.valor_quota_cent * c.fundo_reserva_pct / 100)::int,
       (m + (c.dia_vencimento - 1) * interval '1 day')::date
from condominios c
join fracoes f on f.condominio_id = c.id
cross join generate_series('2026-01-01'::date, '2026-11-01'::date, interval '1 month') m;

-- Pagamentos por transferência. Fração 4 paga março a maio de uma só vez (10/05).
create temp table _pagas as
select q.*, f.identificacao,
       case when q.fracao_id = 'f0000000-0000-0000-0000-000000000004' and q.mes between '2026-03-01' and '2026-05-01'
            then 'lump4' else q.id::text end as grupo
from quotas q join fracoes f on f.id = q.fracao_id
where (q.fracao_id <> 'f0000000-0000-0000-0000-000000000004'
       and (q.mes <= '2026-10-01'
            or (q.mes = '2026-11-01' and q.fracao_id <> 'f0000000-0000-0000-0000-000000000005')))
   or (q.fracao_id = 'f0000000-0000-0000-0000-000000000004' and q.mes <= '2026-07-01');

insert into pagamentos (id, condominio_id, fracao_id, valor_cent, data, meio, referencia_extrato)
select md5('pag' || grupo)::uuid, min(condominio_id::text)::uuid, min(fracao_id::text)::uuid, sum(valor_cent),
       case when grupo = 'lump4' then date '2026-05-10' else min(data_limite) - 3 end,
       'transferencia', 'TRF QUOTA ' || min(identificacao)
from _pagas group by grupo;

insert into pagamento_quotas (pagamento_id, quota_id, condominio_id, valor_cent)
select md5('pag' || grupo)::uuid, id, condominio_id, valor_cent from _pagas;

update quotas set estado = 'paga' where id in (select id from _pagas);
drop table _pagas;

-- Despesas correntes recorrentes (janeiro a outubro).
insert into despesas (condominio_id, data, valor_cent, categoria, fornecedor, recorrente, descricao)
select '11111111-1111-1111-1111-111111111111', (m + interval '14 days')::date, v.valor, v.cat, v.forn, true, v.cat::text || ' ' || to_char(m, 'MM/YYYY')
from generate_series('2026-01-01'::date, '2026-10-01'::date, interval '1 month') m
cross join (values
  (3800::int, 'luz'::categoria_despesa,     'Eletricidade Exemplo, S.A.'),
  (2400::int, 'agua'::categoria_despesa,    'Águas Exemplo, E.M.'),
  (9000::int, 'limpeza'::categoria_despesa, 'Limpezas Brilho, Lda.')
) as v(valor, cat, forn);

-- Despesa extraordinária paga pelo fundo de reserva.
insert into despesas (condominio_id, data, valor_cent, categoria, fornecedor, recorrente, paga_pelo_fundo, descricao)
values ('11111111-1111-1111-1111-111111111111', '2026-06-20', 18000, 'manutencao', 'Serralharia Central, Lda.', false, true,
        'Reparação do portão da garagem');
