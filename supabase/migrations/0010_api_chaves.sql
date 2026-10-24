-- Chaves de API por organização (acesso somente leitura, sem custo, para integrações).
-- O texto da chave aparece uma única vez, na criação; o banco guarda só o hash (SHA-256).

create table api_chave (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  criado_por     uuid not null,
  nome           text not null check (length(nome) between 1 and 80),
  prefixo        text not null,
  hash           text not null unique,
  criado_em      timestamptz not null default now(),
  ultimo_uso     timestamptz,
  revogada_em    timestamptz
);
create index api_chave_org_idx on api_chave (organizacao_id, criado_em desc);
alter table api_chave enable row level security;
create policy api_chave_admin on api_chave for all
  using (eh_administrador(organizacao_id))
  with check (eh_administrador(organizacao_id) and criado_por = auth.uid());

-- A requisição por chave chega sem sessão: este é o único caminho de leitura entre organizações (dono do banco).
-- Só vale enquanto a chave não foi revogada e quem a criou continua membro administrador.
create or replace function api_chave_validar(p_hash text) returns table (organizacao_id uuid, usuario_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
    update api_chave k set ultimo_uso = now()
     where k.hash = p_hash and k.revogada_em is null
       and exists (select 1 from membro m where m.organizacao_id = k.organizacao_id and m.usuario_id = k.criado_por and m.papel = 'administrador')
    returning k.organizacao_id, k.criado_por;
end $$;
revoke all on function api_chave_validar(text) from public;
grant execute on function api_chave_validar(text) to conecta_app;
grant select, insert, update, delete on api_chave to conecta_app;
