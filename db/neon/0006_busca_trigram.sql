-- Só no Neon (o banco local embutido não tem pg_trgm): acelera a pesquisa por nome com trechos do texto.
create extension if not exists pg_trgm;
create index if not exists rf_est_busca_trgm on rf_estabelecimento using gin (busca gin_trgm_ops);
create index if not exists rf_est_bairro_trgm on rf_estabelecimento using gin (bairro gin_trgm_ops);
create index if not exists rf_cnae_busca_trgm on rf_cnae using gin (busca gin_trgm_ops);
