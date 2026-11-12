-- Regista um pagamento e as suas alocações a quotas numa só transação (RLS do chamador aplica-se).
-- p_alocacoes: [{"quota_id": "...", "valor_cent": 4500}, ...]; a soma tem de igualar p_valor.
create function registar_pagamento(
  p_condominio uuid,
  p_fracao uuid,
  p_valor integer,
  p_data date,
  p_meio meio_pagamento,
  p_referencia text,
  p_alocacoes jsonb
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

  insert into pagamentos (condominio_id, fracao_id, valor_cent, data, meio, referencia_extrato)
  values (p_condominio, p_fracao, p_valor, p_data, p_meio, p_referencia)
  returning id into v_id;

  insert into pagamento_quotas (pagamento_id, quota_id, condominio_id, valor_cent)
  select v_id, (x->>'quota_id')::uuid, p_condominio, (x->>'valor_cent')::integer
  from jsonb_array_elements(p_alocacoes) x;

  -- Nenhuma quota pode ficar paga acima do seu valor; as quotas têm de ser desta fração.
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

grant execute on function registar_pagamento(uuid, uuid, integer, date, meio_pagamento, text, jsonb) to authenticated;
