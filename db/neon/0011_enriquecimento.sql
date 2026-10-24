-- Cache das fontes extras de informação da empresa (CVM, Wikidata, notícias, sanções). Dado público, compartilhado entre organizações.
create table enriquecimento_cache (
  cnpj      text not null check (cnpj ~ '^[0-9]{14}$'),
  fonte     text not null check (fonte in ('cvm', 'wikidata', 'noticias', 'sancoes')),
  dados     jsonb not null,
  obtido_em timestamptz not null default now(),
  primary key (cnpj, fonte)
);
alter table enriquecimento_cache enable row level security;
create policy enriquecimento_leitura on enriquecimento_cache for select using (auth.uid() is not null);
create policy app_interno on enriquecimento_cache for all to conecta_app using (true) with check (true);
grant select, insert, update, delete on enriquecimento_cache to conecta_app;

-- Novo status de e-mail: o domínio tem servidor de e-mail (checagem gratuita por MX; não confirma que a caixa existe).
alter table contato drop constraint if exists contato_email_status_check;
alter table contato add constraint contato_email_status_check
  check (email_status in ('verificado', 'nao_verificado', 'inferido', 'dominio_ok'));
