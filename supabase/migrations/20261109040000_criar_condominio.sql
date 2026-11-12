-- Onboarding: o utilizador autenticado, sem condomínio, cria o seu prédio e torna-se administrador.
-- security definer porque, antes de existir, ainda não há administração que autorize as inserções (RLS).
create function criar_condominio(p_nome_admin text, p_condominio jsonb, p_fracoes jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_cond uuid;
  v_pessoa uuid;
begin
  if v_uid is null then raise exception 'sem_sessao'; end if;
  if exists (select 1 from pessoas where auth_user_id = v_uid) then raise exception 'ja_tem_condominio'; end if;
  if p_fracoes is null or jsonb_array_length(p_fracoes) = 0 then raise exception 'sem_fracoes'; end if;

  insert into condominios (nome, morada, nif, iban, modo_quota, valor_quota_cent, fundo_reserva_pct, dia_vencimento)
  values (
    p_condominio ->> 'nome', p_condominio ->> 'morada', nullif(p_condominio ->> 'nif', ''), nullif(p_condominio ->> 'iban', ''),
    (p_condominio ->> 'modo_quota')::modo_quota, (p_condominio ->> 'valor_quota_cent')::integer,
    (p_condominio ->> 'fundo_reserva_pct')::numeric, (p_condominio ->> 'dia_vencimento')::smallint
  ) returning id into v_cond;

  insert into pessoas (condominio_id, auth_user_id, nome, email) values (v_cond, v_uid, p_nome_admin, v_email)
  returning id into v_pessoa;

  insert into administracoes (condominio_id, pessoa_id, inicio)
  values (v_cond, v_pessoa, (now() at time zone 'Europe/Lisbon')::date);

  insert into fracoes (condominio_id, identificacao, tipo, permilagem)
  select v_cond, x ->> 'identificacao', 'habitacao', (x ->> 'permilagem')::numeric from jsonb_array_elements(p_fracoes) x;

  insert into registo_atividade (condominio_id, pessoa_id, acao, entidade, entidade_id)
  values (v_cond, v_pessoa, 'condominio.criado', 'condominios', v_cond);

  return v_cond;
end $$;

revoke all on function criar_condominio(text, jsonb, jsonb) from public, anon;
grant execute on function criar_condominio(text, jsonb, jsonb) to authenticated;
