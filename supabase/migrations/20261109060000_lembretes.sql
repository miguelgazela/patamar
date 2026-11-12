-- Lembretes de quotas em atraso: configuração por condomínio e histórico de envios.
alter table condominios
  add column lembretes_automaticos boolean not null default false,
  add column lembrete_tolerancia_dias smallint not null default 5 check (lembrete_tolerancia_dias between 0 and 60),
  add column lembrete_intervalo_dias smallint not null default 15 check (lembrete_intervalo_dias between 1 and 90);

create type estado_lembrete as enum ('enviado', 'falhou');

create table lembretes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null,
  fracao_id uuid not null,
  pessoa_id uuid,
  email text not null,
  enviado_em timestamptz not null default now(),
  data date not null,
  dias_desde_primeiro_incumprimento integer not null,
  divida_cent integer not null,
  quotas_em_atraso smallint not null,
  modo text not null check (modo in ('manual', 'automatico')),
  estado estado_lembrete not null default 'enviado',
  foreign key (fracao_id, condominio_id) references fracoes (id, condominio_id) on delete cascade
);
create index on lembretes (condominio_id, fracao_id, data desc);

alter table lembretes enable row level security;
create policy admin_all on lembretes for all using (e_admin(condominio_id)) with check (e_admin(condominio_id));
