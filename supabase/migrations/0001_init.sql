-- Conecta-B2B: esquema inicial (multi-tenant, créditos, contatos com dado pago oculto).
-- Regras de segurança:
--  * toda tabela com dado de cliente tem RLS ligado, filtrando por organização;
--  * e-mail e telefone ficam em contato_dado, SEM política para o cliente: só saem por revelar_contato();
--  * cobranças passam por cobrar_creditos(), que serializa por organização e é idempotente.

create table organizacao (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  criado_em  timestamptz not null default now()
);

create table membro (
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  usuario_id     uuid not null references auth.users(id) on delete cascade,
  papel          text not null check (papel in ('administrador', 'membro')),
  primary key (organizacao_id, usuario_id)
);

-- Personalização por tenant: custos, rótulos, sinais e campos próprios.
create table config_tenant (
  organizacao_id uuid primary key references organizacao(id) on delete cascade,
  custos         jsonb not null default '{"busca_decisores":1,"revelar_email":1,"revelar_telefone":5}',
  rotulos        jsonb not null default '{}',
  sinais_ativos  text[] not null default '{}',
  campos         jsonb not null default '[]'
);

create or replace function eh_membro(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membro m where m.organizacao_id = org and m.usuario_id = auth.uid()
  );
$$;

create or replace function eh_administrador(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membro m
     where m.organizacao_id = org and m.usuario_id = auth.uid() and m.papel = 'administrador'
  );
$$;

-- Dados públicos de empresa (cache da base de CNPJ). Leitura para qualquer usuário autenticado.
create table empresa_cache (
  cnpj      text primary key check (cnpj ~ '^[0-9]{14}$'),
  dados     jsonb not null,
  fonte     text not null,
  obtido_em timestamptz not null default now()
);

-- Sinais de compra genéricos (rádio é só um tipo). organizacao_id nulo = sinal compartilhado.
create table sinal (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid references organizacao(id) on delete cascade,
  tipo           text not null,
  fonte          text not null,
  cnpj           text,
  ocorrido_em    timestamptz not null,
  conteudo       jsonb not null default '{}'
);
create index sinal_cnpj_idx on sinal (cnpj, ocorrido_em desc);

create table contato (
  id               uuid primary key default gen_random_uuid(),
  organizacao_id   uuid not null references organizacao(id) on delete cascade,
  cnpj             text not null check (cnpj ~ '^[0-9]{14}$'),
  nome             text not null,
  cargo            text not null,
  senioridade      text,
  departamento     text,
  linkedin_url     text,
  tem_email        boolean not null default false,
  tem_telefone     boolean not null default false,
  email_revelado   boolean not null default false,
  telefone_revelado boolean not null default false,
  email_status     text check (email_status in ('verificado', 'nao_verificado', 'inferido')),
  origem           text not null,
  obtido_em        timestamptz not null,
  confianca        numeric(3, 2) not null check (confianca between 0 and 1),
  unique (organizacao_id, cnpj, nome, cargo)
);

-- E-mail e telefone completos. Sem política para o cliente: acesso só via revelar_contato().
create table contato_dado (
  contato_id uuid primary key references contato(id) on delete cascade,
  email      text,
  telefone   text
);

create table lista (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  nome           text not null check (length(trim(nome)) > 0),
  criado_em      timestamptz not null default now()
);

-- Listas guardam referências (ponteiros), sem copiar contatos.
create table lista_item (
  lista_id   uuid not null references lista(id) on delete cascade,
  contato_id uuid not null references contato(id) on delete cascade,
  primary key (lista_id, contato_id)
);

create table credito_lancamento (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  operacao       text not null check (operacao in
                   ('busca_decisores', 'revelar_email', 'revelar_telefone', 'recarga', 'estorno')),
  valor          integer not null check (valor <> 0),
  saldo_apos     integer not null check (saldo_apos >= 0),
  descricao      text not null,
  chave          text,
  estorna_id     uuid references credito_lancamento(id),
  criado_em      timestamptz not null default now()
);
create unique index credito_chave_uq on credito_lancamento (organizacao_id, operacao, chave)
  where chave is not null;
create unique index credito_estorno_uq on credito_lancamento (estorna_id) where estorna_id is not null;

-- Opt-out global: quem pediu para não ser contatado não volta em nenhuma busca.
create table opt_out (
  email     text primary key check (email = lower(email)),
  criado_em timestamptz not null default now()
);

create or replace function saldo_creditos(org uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(valor), 0)::integer from credito_lancamento where organizacao_id = org;
$$;

-- Cobrança idempotente e serializada por organização (evita saldo negativo em corrida).
create or replace function cobrar_creditos(
  org uuid, p_operacao text, p_custo integer, p_descricao text, p_chave text default null
) returns credito_lancamento
language plpgsql security definer set search_path = public as $$
declare
  existente credito_lancamento;
  saldo integer;
  novo credito_lancamento;
begin
  if not eh_membro(org) then raise exception 'sem acesso' using errcode = '42501'; end if;
  if p_operacao not in ('busca_decisores', 'revelar_email', 'revelar_telefone') then
    raise exception 'operação inválida';
  end if;
  if p_custo <= 0 then raise exception 'custo deve ser positivo'; end if;

  perform pg_advisory_xact_lock(hashtext(org::text));

  if p_chave is not null then
    select * into existente from credito_lancamento
     where organizacao_id = org and operacao = p_operacao and chave = p_chave;
    if found then return existente; end if;
  end if;

  saldo := saldo_creditos(org);
  if saldo < p_custo then
    raise exception 'saldo insuficiente' using errcode = 'P0001';
  end if;

  insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao, chave)
  values (org, p_operacao, -p_custo, saldo - p_custo, p_descricao, p_chave)
  returning * into novo;
  return novo;
end $$;

create or replace function estornar_creditos(org uuid, p_lancamento uuid, p_motivo text)
returns credito_lancamento
language plpgsql security definer set search_path = public as $$
declare
  original credito_lancamento;
  existente credito_lancamento;
  novo credito_lancamento;
begin
  if not eh_membro(org) then raise exception 'sem acesso' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(org::text));
  select * into original from credito_lancamento where id = p_lancamento and organizacao_id = org;
  if not found or original.valor >= 0 then raise exception 'só é possível estornar uma cobrança'; end if;
  select * into existente from credito_lancamento where estorna_id = p_lancamento;
  if found then return existente; end if;
  insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao, estorna_id)
  values (org, 'estorno', -original.valor, saldo_creditos(org) - original.valor,
          'Estorno: ' || p_motivo, p_lancamento)
  returning * into novo;
  return novo;
end $$;

-- Revela e-mail ou telefone: cobra uma vez (idempotente) e devolve o dado. Dado inexistente não cobra.
create or replace function revelar_contato(p_contato uuid, p_campo text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  c contato;
  d contato_dado;
  custo integer;
  operacao text;
begin
  if p_campo not in ('email', 'telefone') then raise exception 'campo inválido'; end if;
  select * into c from contato where id = p_contato;
  if not found or not eh_membro(c.organizacao_id) then
    raise exception 'contato não encontrado' using errcode = '42501';
  end if;
  select * into d from contato_dado where contato_id = p_contato;
  if (p_campo = 'email' and d.email is null) or (p_campo = 'telefone' and d.telefone is null) then
    raise exception 'dado inexistente, nada foi cobrado';
  end if;

  operacao := 'revelar_' || p_campo;
  select coalesce((cfg.custos ->> operacao)::integer, case p_campo when 'email' then 1 else 5 end)
    into custo
    from (select 1) x
    left join config_tenant cfg on cfg.organizacao_id = c.organizacao_id;

  perform cobrar_creditos(c.organizacao_id, operacao, custo,
    'Revelar ' || p_campo || ': ' || c.nome, 'rev:' || c.id || ':' || p_campo);

  if p_campo = 'email' then
    update contato set email_revelado = true where id = p_contato;
    return d.email;
  else
    update contato set telefone_revelado = true where id = p_contato;
    return d.telefone;
  end if;
end $$;

-- Segurança por linha.
alter table organizacao        enable row level security;
alter table membro             enable row level security;
alter table config_tenant      enable row level security;
alter table empresa_cache      enable row level security;
alter table sinal              enable row level security;
alter table contato            enable row level security;
alter table contato_dado       enable row level security;
alter table lista              enable row level security;
alter table lista_item         enable row level security;
alter table credito_lancamento enable row level security;
alter table opt_out            enable row level security;

create policy org_leitura on organizacao for select using (eh_membro(id));
create policy membro_leitura on membro for select using (eh_membro(organizacao_id));
create policy membro_admin on membro for all
  using (eh_administrador(organizacao_id)) with check (eh_administrador(organizacao_id));
create policy config_leitura on config_tenant for select using (eh_membro(organizacao_id));
create policy config_admin on config_tenant for update
  using (eh_administrador(organizacao_id)) with check (eh_administrador(organizacao_id));
create policy empresa_leitura on empresa_cache for select using (auth.uid() is not null);
create policy sinal_leitura on sinal for select
  using (organizacao_id is null or eh_membro(organizacao_id));
create policy contato_leitura on contato for select using (eh_membro(organizacao_id));
-- contato_dado, opt_out: sem política para o cliente (acesso só por funções e pela chave de serviço).
create policy lista_tudo on lista for all
  using (eh_membro(organizacao_id)) with check (eh_membro(organizacao_id));
create policy lista_item_tudo on lista_item for all
  using (exists (select 1 from lista l where l.id = lista_id and eh_membro(l.organizacao_id)))
  with check (
    exists (select 1 from lista l where l.id = lista_id and eh_membro(l.organizacao_id))
    and exists (select 1 from contato c where c.id = contato_id and eh_membro(c.organizacao_id))
  );
create policy credito_leitura on credito_lancamento for select using (eh_membro(organizacao_id));
-- Lançamentos são criados só pelas funções acima (sem política de escrita para o cliente).
