-- Correções da revisão da v1.

-- 1. Fuso horário: o mandato e a data por omissão usam a data de Lisboa (o servidor corre em UTC).
create or replace function e_admin(cond uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from administracoes a
    join pessoas p on p.id = a.pessoa_id and p.condominio_id = a.condominio_id
    where a.condominio_id = cond
      and p.auth_user_id = auth.uid()
      and a.inicio <= (now() at time zone 'Europe/Lisbon')::date
      and (a.fim is null or a.fim >= (now() at time zone 'Europe/Lisbon')::date)
  )
$$;
alter table documentos alter column data set default (now() at time zone 'Europe/Lisbon')::date;

-- 2. registar_pagamento: bloqueia as quotas (dois pagamentos simultâneos não passam ambos) e recusa quotas anuladas.
create or replace function registar_pagamento(
  p_condominio uuid, p_fracao uuid, p_valor integer, p_data date, p_meio meio_pagamento,
  p_referencia text, p_alocacoes jsonb, p_chave text default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_soma integer;
begin
  select coalesce(sum((x->>'valor_cent')::integer), 0) into v_soma from jsonb_array_elements(p_alocacoes) x;
  if v_soma <> p_valor then
    raise exception 'alocacoes_invalidas' using errcode = 'P0001';
  end if;

  -- Serializa pagamentos concorrentes sobre as mesmas quotas.
  perform 1 from quotas
   where id in (select (x->>'quota_id')::uuid from jsonb_array_elements(p_alocacoes) x)
   order by id for update;

  if exists (
    select 1 from quotas
    where id in (select (x->>'quota_id')::uuid from jsonb_array_elements(p_alocacoes) x)
      and (estado = 'anulada' or fracao_id <> p_fracao)
  ) then
    raise exception 'quota_invalida' using errcode = 'P0001';
  end if;

  insert into pagamentos (condominio_id, fracao_id, valor_cent, data, meio, referencia_extrato, extrato_chave)
  values (p_condominio, p_fracao, p_valor, p_data, p_meio, p_referencia, p_chave)
  returning id into v_id;

  insert into pagamento_quotas (pagamento_id, quota_id, condominio_id, valor_cent)
  select v_id, (x->>'quota_id')::uuid, p_condominio, (x->>'valor_cent')::integer
  from jsonb_array_elements(p_alocacoes) x;

  if exists (
    select 1 from quotas q
    join (select quota_id, sum(valor_cent) as pago from pagamento_quotas
          where quota_id in (select (x->>'quota_id')::uuid from jsonb_array_elements(p_alocacoes) x)
          group by quota_id) s on s.quota_id = q.id
    where s.pago > q.valor_cent
  ) then
    raise exception 'quota_excedida' using errcode = 'P0001';
  end if;

  update quotas q set estado = case when s.pago >= q.valor_cent then 'paga'::estado_quota else 'parcial'::estado_quota end
  from (select quota_id, sum(valor_cent) as pago from pagamento_quotas
        where quota_id in (select (x->>'quota_id')::uuid from jsonb_array_elements(p_alocacoes) x)
        group by quota_id) s
  where q.id = s.quota_id;

  return v_id;
end $$;

-- 3. Funções de leitura agregada: sem acesso anónimo explícito.
revoke all on function contas_do_predio(uuid) from anon;
revoke all on function despesas_por_categoria(uuid, integer) from anon;

-- 4. Registo de atividade: o administrador só acrescenta e lê (não reescreve a própria auditoria).
drop policy admin_all on registo_atividade;
create policy admin_le on registo_atividade for select using (e_admin(condominio_id));
create policy admin_acrescenta on registo_atividade for insert with check (e_admin(condominio_id));

-- 5. Um lembrete «enviado» por fração, pessoa e dia: duas execuções em paralelo não duplicam o email.
create unique index lembretes_um_por_dia on lembretes (fracao_id, pessoa_id, data) where estado = 'enviado' and pessoa_id is not null;

-- 6. Índices em falta.
create index on pagamento_quotas (quota_id);
create index on pagamento_quotas (condominio_id);
create index on pagamentos (fracao_id);
