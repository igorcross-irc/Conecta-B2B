-- Pesquisas salvas com aviso por e-mail quando surgem empresas novas (abertas desde o último aviso).

create table pesquisa_salva (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  criado_por     uuid not null,
  nome           text not null check (length(nome) between 1 and 80),
  filtros        jsonb not null,
  avisar         boolean not null default true,
  ultimo_aviso   date not null default current_date,
  criado_em      timestamptz not null default now()
);
create index pesquisa_salva_org_idx on pesquisa_salva (organizacao_id, criado_em desc);
alter table pesquisa_salva enable row level security;
create policy pesquisa_salva_membro on pesquisa_salva for all
  using (eh_membro(organizacao_id)) with check (eh_membro(organizacao_id) and criado_por = auth.uid());

-- O aviso diário roda sem usuário e atravessa organizações: lê pelas funções abaixo (dono do banco), não por acesso irrestrito.
create or replace function alertas_pendentes() returns table (
  id uuid, organizacao_id uuid, nome text, filtros jsonb, ultimo_aviso date, email text
) language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.id, p.organizacao_id, p.nome, p.filtros, p.ultimo_aviso, u.email::text
      from pesquisa_salva p join neon_auth."user" u on u.id = p.criado_por
     where p.avisar and p.ultimo_aviso < current_date and u.email is not null
     order by p.ultimo_aviso, p.criado_em
     limit 50;
end $$;

create or replace function alerta_registrar(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update pesquisa_salva set ultimo_aviso = current_date where id = p_id;
$$;

revoke all on function alertas_pendentes() from public;
revoke all on function alerta_registrar(uuid) from public;
grant execute on function alertas_pendentes() to conecta_app;
grant execute on function alerta_registrar(uuid) to conecta_app;
grant select, insert, update, delete on pesquisa_salva to conecta_app;
