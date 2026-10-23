-- Pool compartilhado de resultados de busca e buscas em segundo plano.

-- Resultado de uma varredura das fontes para uma empresa. Compartilhado entre organizações: o que
-- uma varredura achou serve à próxima, sem repetir o trabalho. A chave inclui as fontes usadas
-- (fonte_chave) e os cargos pedidos, então trocar ou acrescentar uma fonte gera uma varredura nova.
-- Sem política de leitura: só o servidor acessa. O cliente recebe os dados pela cobrança/revelação.
create table pool_busca (
  cnpj         text not null check (cnpj ~ '^[0-9]{14}$'),
  fonte_chave  text not null,
  cargos_chave text not null,
  contatos     jsonb not null default '[]',
  tentativas   jsonb not null default '[]',
  obtido_em    timestamptz not null default now(),
  primary key (cnpj, fonte_chave, cargos_chave)
);
alter table pool_busca enable row level security;

-- Busca de decisores que roda em segundo plano. Um trabalho em andamento por empresa e organização.
create table busca_job (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  cnpj           text not null check (cnpj ~ '^[0-9]{14}$'),
  cargos         text[] not null default '{}',
  chave          text not null,
  status         text not null default 'em_andamento' check (status in ('em_andamento', 'concluida', 'erro')),
  etapa          text not null default 'Na fila',
  do_pool        boolean not null default false,
  cobranca_id    uuid references credito_lancamento(id),
  contato_ids    uuid[] not null default '{}',
  erro           text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (organizacao_id, chave)
);
create unique index busca_job_andamento_uq on busca_job (organizacao_id, cnpj) where status = 'em_andamento';
alter table busca_job enable row level security;
create policy busca_job_leitura on busca_job for select using (eh_membro(organizacao_id));
