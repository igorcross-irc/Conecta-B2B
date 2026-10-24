-- Monitoramento sem serviço externo: cada chamada a uma fonte de dados e cada erro inesperado ficam registrados no próprio banco
-- e aparecem em Plataforma > Provedores e Plataforma > Saúde. Dado técnico, sem informação pessoal (só nomes de fonte, tempos e mensagens curtas).

create table provedor_execucao (
  id        bigserial primary key,
  provedor  text not null,
  tipo      text not null check (tipo in ('empresa', 'contatos', 'enriquecimento', 'ia', 'email')),
  ok        boolean not null,
  ms        integer not null check (ms >= 0),
  itens     integer,
  erro      text,
  criado_em timestamptz not null default now()
);
create index provedor_execucao_nome_idx on provedor_execucao (provedor, criado_em desc);
create index provedor_execucao_tempo_idx on provedor_execucao (criado_em desc);

create table erro_app (
  id        bigserial primary key,
  origem    text not null,
  mensagem  text not null,
  detalhe   text,
  criado_em timestamptz not null default now()
);
create index erro_app_tempo_idx on erro_app (criado_em desc);

-- Tabelas internas do servidor: só o código do servidor lê e escreve (o cliente nunca).
alter table provedor_execucao enable row level security;
alter table erro_app enable row level security;
create policy app_interno on provedor_execucao for all to conecta_app using (true) with check (true);
create policy app_interno on erro_app for all to conecta_app using (true) with check (true);
grant select, insert, update, delete on provedor_execucao, erro_app to conecta_app;
grant usage, select on sequence provedor_execucao_id_seq, erro_app_id_seq to conecta_app;

-- Limpeza: guarda 30 dias de histórico.
create or replace function limpar_monitoramento() returns void
language sql as $$
  delete from provedor_execucao where criado_em < now() - interval '30 days';
  delete from erro_app where criado_em < now() - interval '30 days';
$$;
