-- Lista de municípios da base da Receita, para sugerir cidades ao digitar (a base tem milhões de linhas: não dá para varrer a cada tecla).
create table rf_municipio (
  uf         text not null,
  nome       text not null,
  nome_busca text not null,
  qtd        integer not null,
  primary key (uf, nome)
);
create index rf_municipio_busca_idx on rf_municipio (uf, nome_busca text_pattern_ops);
alter table rf_municipio enable row level security;
create policy rf_municipio_leitura on rf_municipio for select using (auth.uid() is not null);
create policy app_interno on rf_municipio for all to conecta_app using (true) with check (true);
grant select, insert, update, delete on rf_municipio to conecta_app;

create or replace function atualizar_municipios() returns integer
language plpgsql as $$
declare n integer;
begin
  delete from rf_municipio;
  insert into rf_municipio (uf, nome, nome_busca, qtd)
    select uf, municipio, lower(translate(municipio, 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')), count(*)::integer
      from rf_estabelecimento where uf is not null and municipio is not null and municipio <> ''
     group by uf, municipio;
  get diagnostics n = row_count;
  return n;
end $$;

-- Carga inicial com o que já foi importado.
select atualizar_municipios();
