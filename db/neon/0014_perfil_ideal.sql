-- Perfil de cliente ideal (ICP) de cada organização: a pesquisa mostra e ordena as empresas por aderência a ele.
create table perfil_ideal (
  organizacao_id uuid primary key references organizacao(id) on delete cascade,
  perfil         jsonb not null,
  atualizado_por uuid,
  atualizado_em  timestamptz not null default now()
);
alter table perfil_ideal enable row level security;
create policy perfil_ideal_leitura on perfil_ideal for select using (eh_membro(organizacao_id));
create policy perfil_ideal_admin on perfil_ideal for all
  using (eh_administrador(organizacao_id)) with check (eh_administrador(organizacao_id));
grant select, insert, update, delete on perfil_ideal to conecta_app;
