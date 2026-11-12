-- Totais de despesas por categoria num ano, visíveis a qualquer condómino (sem linhas individuais).
create function despesas_por_categoria(cond uuid, ano integer)
returns table (categoria categoria_despesa, total_cent bigint)
language sql stable security definer set search_path = public as $$
  select d.categoria, sum(d.valor_cent)::bigint
  from despesas d
  where d.condominio_id = cond
    and extract(year from d.data) = ano
    and (e_condomino(cond) or e_admin(cond))
  group by d.categoria
  order by 2 desc
$$;

revoke all on function despesas_por_categoria(uuid, integer) from public;
grant execute on function despesas_por_categoria(uuid, integer) to authenticated;
