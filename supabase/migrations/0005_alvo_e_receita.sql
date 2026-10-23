-- O "alvo" de uma pesquisa pode ser um CNPJ (14 dígitos) ou um site ("site:empresa.com.br").
-- Também cria a base de estabelecimentos da Receita Federal (carregada por scripts/importar-receita.ts)
-- usada na pesquisa por nome, estado, cidade, bairro e segmento.

alter table empresa_cache drop constraint if exists empresa_cache_cnpj_check;
alter table empresa_cache add constraint empresa_cache_cnpj_check check (cnpj ~ '^([0-9]{14}|site:[a-z0-9.-]+)$');
alter table contato drop constraint if exists contato_cnpj_check;
alter table contato add constraint contato_cnpj_check check (cnpj ~ '^([0-9]{14}|site:[a-z0-9.-]+)$');
alter table pool_busca drop constraint if exists pool_busca_cnpj_check;
alter table pool_busca add constraint pool_busca_cnpj_check check (cnpj ~ '^([0-9]{14}|site:[a-z0-9.-]+)$');
alter table busca_job drop constraint if exists busca_job_cnpj_check;
alter table busca_job add constraint busca_job_cnpj_check check (cnpj ~ '^([0-9]{14}|site:[a-z0-9.-]+)$');
alter table base_empresa_info drop constraint if exists base_empresa_info_cnpj_check;
alter table base_empresa_info add constraint base_empresa_info_cnpj_check check (cnpj ~ '^([0-9]{14}|site:[a-z0-9.-]+)$');
alter table base_contato drop constraint if exists base_contato_cnpj_check;
alter table base_contato add constraint base_contato_cnpj_check check (cnpj ~ '^([0-9]{14}|site:[a-z0-9.-]+)$');

create table rf_estabelecimento (
  cnpj          text primary key check (cnpj ~ '^[0-9]{14}$'),
  razao_social  text not null,
  nome_fantasia text,
  matriz        boolean not null default true,
  situacao      text,
  cnae          integer,
  uf            text,
  municipio     text,
  bairro        text,
  cep           text,
  porte         text,
  email         text,
  telefone      text,
  aberta_em     date,
  busca         text not null
);
create index rf_est_uf_municipio on rf_estabelecimento (uf, municipio);
create index rf_est_cnae on rf_estabelecimento (cnae);

create table rf_cnae (
  codigo    integer primary key,
  descricao text not null,
  busca     text not null
);

alter table rf_estabelecimento enable row level security;
alter table rf_cnae enable row level security;
create policy rf_estabelecimento_leitura on rf_estabelecimento for select using (auth.uid() is not null);
create policy rf_cnae_leitura on rf_cnae for select using (auth.uid() is not null);
