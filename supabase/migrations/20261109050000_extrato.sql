-- Importação de extrato: mapeamento de colunas por condomínio e chave anti-duplicados por pagamento.
alter table condominios add column mapeamento_extrato jsonb;
alter table pagamentos add column extrato_chave text;
create unique index pagamentos_extrato_chave_uq on pagamentos (condominio_id, extrato_chave) where extrato_chave is not null;

-- Nova versão de registar_pagamento com a chave do extrato (null para pagamentos manuais).
drop function registar_pagamento(uuid, uuid, integer, date, meio_pagamento, text, jsonb);

create function registar_pagamento(
  p_condominio uuid,
  p_fracao uuid,
  p_valor integer,
  p_data date,
  p_meio meio_pagamento,
  p_referencia text,
  p_alocacoes jsonb,
  p_chave text default null
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
    where s.pago > q.valor_cent or q.fracao_id <> p_fracao
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

grant execute on function registar_pagamento(uuid, uuid, integer, date, meio_pagamento, text, jsonb, text) to authenticated;
