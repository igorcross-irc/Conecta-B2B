-- Pesquisa por nome por palavras (início de cada palavra), com índice: de ~3 s para ~30 ms nas 2,2 mi empresas do RJ.
-- Usa só recursos do Postgres puro (sem pg_trgm); no Neon ocupa ~90 MB com o RJ inteiro e ~1 GB com o Brasil (matrizes ativas).
create index if not exists rf_est_busca_fts on rf_estabelecimento using gin (to_tsvector('simple', busca));
