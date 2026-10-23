-- Plataforma: operadora, convites de equipe, base colaborativa, auditoria e créditos iniciais configuráveis.

-- Operadora: quem administra a plataforma inteira (todas as organizações). Sem política: só o servidor altera.
create table operadora (
  usuario_id uuid primary key,
  criado_em  timestamptz not null default now()
);
alter table operadora enable row level security;

create or replace function eh_operadora() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from operadora o where o.usuario_id = auth.uid());
$$;

-- Convites por link secreto (não depende de envio de e-mail). Uso único, expira em 7 dias.
create table convite (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  email          text not null check (email = lower(email)),
  papel          text not null check (papel in ('administrador', 'membro')),
  token          text not null unique,
  criado_por     uuid not null,
  criado_em      timestamptz not null default now(),
  expira_em      timestamptz not null default now() + interval '7 days',
  aceito_em      timestamptz,
  aceito_por     uuid
);
alter table convite enable row level security;
create policy convite_admin on convite for all
  using (eh_administrador(organizacao_id)) with check (eh_administrador(organizacao_id));

create or replace function criar_convite(org uuid, p_email text, p_papel text) returns text
language plpgsql security definer set search_path = public as $$
declare
  t text;
begin
  if not eh_administrador(org) then raise exception 'sem acesso' using errcode = '42501'; end if;
  if p_papel not in ('administrador', 'membro') then raise exception 'papel inválido'; end if;
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into convite (organizacao_id, email, papel, token, criado_por)
    values (org, lower(trim(p_email)), p_papel, t, auth.uid());
  return t;
end $$;

create or replace function aceitar_convite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c convite;
begin
  if auth.uid() is null then raise exception 'sem acesso' using errcode = '42501'; end if;
  select * into c from convite where token = p_token for update;
  if not found or c.aceito_em is not null or c.expira_em < now() then
    raise exception 'convite inválido ou expirado';
  end if;
  insert into membro (organizacao_id, usuario_id, papel) values (c.organizacao_id, auth.uid(), c.papel)
    on conflict (organizacao_id, usuario_id) do nothing;
  update convite set aceito_em = now(), aceito_por = auth.uid() where id = c.id;
  return c.organizacao_id;
end $$;

-- Toda organização precisa de pelo menos um administrador.
create or replace function proteger_ultimo_admin() returns trigger
language plpgsql as $$
begin
  if old.papel = 'administrador'
     and (tg_op = 'DELETE' or new.papel <> 'administrador')
     and exists (select 1 from organizacao o where o.id = old.organizacao_id)
     and not exists (
       select 1 from membro m
        where m.organizacao_id = old.organizacao_id and m.papel = 'administrador' and m.usuario_id <> old.usuario_id
     ) then
    raise exception 'a organização precisa de ao menos um administrador';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger membro_ultimo_admin before update or delete on membro
  for each row execute function proteger_ultimo_admin();

-- Recarga de créditos: só a operadora.
create or replace function recarregar_creditos(org uuid, p_valor integer, p_descricao text)
returns credito_lancamento
language plpgsql security definer set search_path = public as $$
declare
  novo credito_lancamento;
begin
  if not eh_operadora() then raise exception 'sem acesso' using errcode = '42501'; end if;
  if p_valor <= 0 then raise exception 'valor deve ser positivo'; end if;
  perform pg_advisory_xact_lock(hashtext(org::text));
  insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
    values (org, 'recarga', p_valor, saldo_creditos(org) + p_valor,
            coalesce(nullif(trim(p_descricao), ''), 'Recarga'))
    returning * into novo;
  return novo;
end $$;

create or replace function renomear_organizacao(org uuid, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_administrador(org) then raise exception 'sem acesso' using errcode = '42501'; end if;
  if length(trim(p_nome)) = 0 then raise exception 'nome vazio'; end if;
  update organizacao set nome = trim(p_nome) where id = org;
end $$;

-- Primeiro acesso: cria a organização. Créditos iniciais configuráveis (0 = não lança nada).
create or replace function garantir_organizacao(p_usuario uuid, p_nome text, p_creditos integer default 20)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
begin
  if auth.uid() is distinct from p_usuario then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('org:' || p_usuario::text));
  select organizacao_id into org from membro where usuario_id = p_usuario order by organizacao_id limit 1;
  if org is not null then return org; end if;
  insert into organizacao (nome)
    values (coalesce(nullif(trim(p_nome), ''), 'Minha organização')) returning id into org;
  insert into membro values (org, p_usuario, 'administrador');
  insert into config_tenant (organizacao_id) values (org);
  if p_creditos > 0 then
    insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
      values (org, 'recarga', p_creditos, p_creditos, 'Créditos iniciais');
  end if;
  return org;
end $$;

-- Base colaborativa: o que um usuário descobre ou corrige vale para todos.
-- Sem política de leitura: só o servidor acessa; o cliente recebe os dados pela busca (com cobrança).
create table base_empresa_info (
  cnpj           text primary key check (cnpj ~ '^[0-9]{14}$'),
  dominio        text,
  nota           text,
  tags           text[] not null default '{}',
  atualizado_por uuid,
  atualizado_em  timestamptz not null default now()
);
alter table base_empresa_info enable row level security;

create table base_contato (
  id              uuid primary key default gen_random_uuid(),
  cnpj            text not null check (cnpj ~ '^[0-9]{14}$'),
  nome            text not null,
  cargo           text not null,
  senioridade     text,
  departamento    text,
  email           text,
  telefone        text,
  linkedin_url    text,
  origem          text not null default 'Contribuição de usuário',
  contribuido_por uuid,
  organizacao_id  uuid references organizacao(id) on delete set null,
  criado_em       timestamptz not null default now()
);
create unique index base_contato_uq on base_contato (cnpj, lower(nome), lower(cargo));
create index base_contato_cnpj_idx on base_contato (cnpj);
alter table base_contato enable row level security;

create table auditoria (
  id             bigserial primary key,
  criado_em      timestamptz not null default now(),
  usuario_id     uuid,
  organizacao_id uuid,
  acao           text not null,
  alvo           text,
  detalhe        jsonb not null default '{}'
);
create index auditoria_org_idx on auditoria (organizacao_id, criado_em desc);
alter table auditoria enable row level security;
create policy auditoria_leitura on auditoria for select
  using (organizacao_id is not null and eh_administrador(organizacao_id));
