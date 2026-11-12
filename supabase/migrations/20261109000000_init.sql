-- Patamar: esquema inicial.
-- Valores monetários em cêntimos inteiros. Datas em `date`; instantes em timestamptz (apresentar em Europe/Lisbon).


-- ---------------------------------------------------------------- enums
create type modo_quota as enum ('fixa', 'permilagem');
create type tipo_fracao as enum ('habitacao', 'loja', 'escritorio', 'garagem', 'outro');
create type tipo_anexo as enum ('box', 'arrecadacao');
create type estado_quota as enum ('pendente', 'parcial', 'paga', 'anulada');
create type meio_pagamento as enum ('transferencia', 'numerario', 'cheque', 'outro');
create type categoria_despesa as enum ('luz', 'agua', 'limpeza', 'elevador', 'seguro', 'manutencao', 'administracao', 'outro');
create type tipo_documento as enum ('relatorio_contas', 'declaracao_encargos', 'ata', 'lembrete', 'outro');

-- ---------------------------------------------------------------- tabelas
create table condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  morada text not null,
  nif text,
  iban text,
  modo_quota modo_quota not null default 'fixa',
  valor_quota_cent integer not null check (valor_quota_cent >= 0),  -- fixa: por fração/mês; permilagem: total mensal do prédio
  fundo_reserva_pct numeric(5,2) not null default 10 check (fundo_reserva_pct between 0 and 100),
  dia_vencimento smallint not null default 8 check (dia_vencimento between 1 and 28),
  criado_em timestamptz not null default now()
);

create table fracoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios on delete cascade,
  identificacao text not null,                       -- ex. "1.º Esq."
  tipo tipo_fracao not null default 'habitacao',
  permilagem numeric(7,3) not null check (permilagem >= 0),
  unique (condominio_id, identificacao),
  unique (id, condominio_id)
);

create table anexos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null,
  fracao_id uuid not null,
  tipo tipo_anexo not null,
  identificacao text not null,
  foreign key (fracao_id, condominio_id) references fracoes (id, condominio_id) on delete cascade
);

create table pessoas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios on delete cascade,
  auth_user_id uuid unique references auth.users on delete set null,
  nome text not null,
  email text,
  telemovel text,
  nif text,                                          -- opcional (RGPD)
  unique (id, condominio_id)
);

create table propriedades (
  pessoa_id uuid not null,
  fracao_id uuid not null,
  condominio_id uuid not null,
  primary key (pessoa_id, fracao_id),
  foreign key (pessoa_id, condominio_id) references pessoas (id, condominio_id) on delete cascade,
  foreign key (fracao_id, condominio_id) references fracoes (id, condominio_id) on delete cascade
);

create table administracoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null,
  pessoa_id uuid not null,
  inicio date not null,
  fim date check (fim is null or fim >= inicio),
  foreign key (pessoa_id, condominio_id) references pessoas (id, condominio_id) on delete cascade
);

create table quotas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null,
  fracao_id uuid not null,
  mes date not null check (extract(day from mes) = 1),   -- primeiro dia do mês
  valor_cent integer not null check (valor_cent >= 0),
  fundo_reserva_cent integer not null default 0 check (fundo_reserva_cent between 0 and valor_cent),
  data_limite date not null,
  estado estado_quota not null default 'pendente',
  unique (fracao_id, mes),
  unique (id, condominio_id),
  foreign key (fracao_id, condominio_id) references fracoes (id, condominio_id) on delete cascade
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios on delete cascade,
  fracao_id uuid not null,
  valor_cent integer not null check (valor_cent > 0),
  data date not null,
  meio meio_pagamento not null default 'transferencia',
  referencia_extrato text,                           -- linha/descrição do extrato bancário
  unique (id, condominio_id),
  foreign key (fracao_id, condominio_id) references fracoes (id, condominio_id)
);

-- Um pagamento pode cobrir várias quotas; uma quota pode ser paga em vários pagamentos.
create table pagamento_quotas (
  pagamento_id uuid not null,
  quota_id uuid not null,
  condominio_id uuid not null,
  valor_cent integer not null check (valor_cent > 0),
  primary key (pagamento_id, quota_id),
  foreign key (pagamento_id, condominio_id) references pagamentos (id, condominio_id) on delete cascade,
  foreign key (quota_id, condominio_id) references quotas (id, condominio_id) on delete cascade
);

create table despesas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios on delete cascade,
  data date not null,
  valor_cent integer not null check (valor_cent > 0),
  categoria categoria_despesa not null default 'outro',
  fornecedor text,
  fornecedor_nif text,
  fatura_path text,                                  -- caminho no Storage
  recorrente boolean not null default false,
  paga_pelo_fundo boolean not null default false,
  descricao text,
  criado_em timestamptz not null default now()
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios on delete cascade,
  tipo tipo_documento not null,
  data date not null default current_date,
  titulo text not null,
  ficheiro_path text,
  fracao_id uuid references fracoes on delete set null
);

create table registo_atividade (
  id bigint generated always as identity primary key,
  condominio_id uuid not null references condominios on delete cascade,
  pessoa_id uuid references pessoas on delete set null,
  acao text not null,
  entidade text,
  entidade_id uuid,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);

create index on fracoes (condominio_id);
create index on pessoas (condominio_id);
create index on quotas (condominio_id, mes);
create index on quotas (fracao_id, estado);
create index on pagamentos (condominio_id, data);
create index on despesas (condominio_id, data);
create index on registo_atividade (condominio_id, criado_em desc);

-- ---------------------------------------------------------------- acesso
-- security definer: evitam recursão de RLS ao ler pessoas/administracoes.
create function pessoa_ids_do_utilizador() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select id from pessoas where auth_user_id = auth.uid()
$$;

create function e_admin(cond uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from administracoes a
    join pessoas p on p.id = a.pessoa_id and p.condominio_id = a.condominio_id
    where a.condominio_id = cond
      and p.auth_user_id = auth.uid()
      and a.inicio <= current_date
      and (a.fim is null or a.fim >= current_date)
  )
$$;

create function e_condomino(cond uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from pessoas where condominio_id = cond and auth_user_id = auth.uid())
$$;

create function minhas_fracoes() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select pr.fracao_id from propriedades pr
  join pessoas p on p.id = pr.pessoa_id
  where p.auth_user_id = auth.uid()
$$;

-- Contas agregadas do prédio, visíveis a qualquer condómino (sem dívidas individuais).
create function contas_do_predio(cond uuid)
returns table (
  total_quotas_emitidas_cent bigint,
  total_quotas_recebidas_cent bigint,
  total_despesas_cent bigint,
  fundo_reserva_cent bigint,
  saldo_cent bigint
)
language sql stable security definer set search_path = public as $$
  with
    rec as (select coalesce(sum(pq.valor_cent), 0) as v from pagamento_quotas pq where pq.condominio_id = cond),
    emi as (select coalesce(sum(valor_cent), 0) as v from quotas where condominio_id = cond and estado <> 'anulada'),
    fun_in as (
      -- parte do fundo de cada quota paga, proporcional ao recebido
      select coalesce(sum(round(pq.valor_cent::numeric * q.fundo_reserva_cent / nullif(q.valor_cent, 0))), 0)::bigint as v
      from pagamento_quotas pq join quotas q on q.id = pq.quota_id
      where pq.condominio_id = cond
    ),
    desp as (select coalesce(sum(valor_cent) filter (where not paga_pelo_fundo), 0) as corrente,
                    coalesce(sum(valor_cent) filter (where paga_pelo_fundo), 0) as do_fundo
             from despesas where condominio_id = cond)
  select emi.v, rec.v, desp.corrente + desp.do_fundo,
         fun_in.v - desp.do_fundo,
         rec.v - desp.corrente - desp.do_fundo
  from rec, emi, fun_in, desp
  where e_condomino(cond) or e_admin(cond)
$$;

-- ---------------------------------------------------------------- RLS
alter table condominios enable row level security;
alter table fracoes enable row level security;
alter table anexos enable row level security;
alter table pessoas enable row level security;
alter table propriedades enable row level security;
alter table administracoes enable row level security;
alter table quotas enable row level security;
alter table pagamentos enable row level security;
alter table pagamento_quotas enable row level security;
alter table despesas enable row level security;
alter table documentos enable row level security;
alter table registo_atividade enable row level security;

-- Administrador: acesso total ao seu condomínio.
create policy admin_all on condominios for all using (e_admin(id)) with check (e_admin(id));
create policy admin_all on fracoes for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on anexos for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on pessoas for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on propriedades for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on administracoes for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on quotas for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on pagamentos for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on pagamento_quotas for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on despesas for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on documentos for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
create policy admin_all on registo_atividade for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));

-- Condómino: só lê o que é seu. Dívidas dos vizinhos ficam fora; contas agregadas via contas_do_predio().
create policy condomino_le on condominios for select using (e_condomino(id));
create policy condomino_le on fracoes for select using (id in (select minhas_fracoes()));
create policy condomino_le on anexos for select using (fracao_id in (select minhas_fracoes()));
create policy condomino_le on pessoas for select using (auth_user_id = auth.uid());
create policy condomino_le on propriedades for select using (pessoa_id in (select pessoa_ids_do_utilizador()));
create policy condomino_le on quotas for select using (fracao_id in (select minhas_fracoes()));
create policy condomino_le on pagamentos for select using (fracao_id in (select minhas_fracoes()));
create policy condomino_le on pagamento_quotas for select using (
  pagamento_id in (select id from pagamentos where fracao_id in (select minhas_fracoes()))
);
create policy condomino_le on documentos for select using (
  e_condomino(condominio_id) and (fracao_id is null or fracao_id in (select minhas_fracoes()))
  and tipo in ('relatorio_contas', 'ata', 'outro', 'declaracao_encargos')
);
-- despesas: condómino não lê linhas (privacidade de fornecedores); vê totais via contas_do_predio().
-- Mudar para leitura das despesas se a assembleia o decidir.

revoke all on function contas_do_predio(uuid) from public;
grant execute on function contas_do_predio(uuid) to authenticated;
