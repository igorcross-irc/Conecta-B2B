-- Papel de banco limitado para a aplicação (conecta_app).
-- Hoje o app conecta como dono do banco, que ignora a segurança por linha (RLS). Com este papel, o isolamento
-- entre organizações passa a ser garantido pelo próprio banco, mesmo que uma consulta esqueça o filtro.
-- Para usar: defina uma senha e troque o usuário da DATABASE_URL (ver docs/papel-de-banco.md):
--   alter role conecta_app login password '<senha longa gerada>';
-- O papel não tem BYPASSRLS, nem CREATE, nem posse de tabelas.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'conecta_app') then
    create role conecta_app nologin;
  end if;
end $$;

grant usage on schema public to conecta_app;
grant usage on schema auth to conecta_app;
grant execute on function auth.uid() to conecta_app;
grant select, insert, update, delete on all tables in schema public to conecta_app;
grant usage, select on all sequences in schema public to conecta_app;
grant execute on all functions in schema public to conecta_app;

-- Cadastro de usuários do Neon Auth (nomes e e-mails da equipe): só leitura.
do $$ begin
  if to_regclass('neon_auth."user"') is not null then
    grant usage on schema neon_auth to conecta_app;
    grant select on neon_auth."user" to conecta_app;
  end if;
end $$;

-- Dados de cada organização: só quem é membro enxerga e altera; a operadora da plataforma enxerga todas.
create policy app_organizacao on organizacao for all to conecta_app
  using (eh_membro(id) or eh_operadora()) with check (eh_administrador(id) or eh_operadora());
create policy app_membro on membro for all to conecta_app
  using (eh_membro(organizacao_id) or eh_operadora()) with check (eh_administrador(organizacao_id) or eh_operadora());
create policy app_config on config_tenant for all to conecta_app
  using (eh_membro(organizacao_id) or eh_operadora()) with check (eh_administrador(organizacao_id) or eh_operadora());
create policy app_contato on contato for all to conecta_app
  using (eh_membro(organizacao_id)) with check (eh_membro(organizacao_id));
create policy app_contato_dado on contato_dado for all to conecta_app
  using (exists (select 1 from contato c where c.id = contato_id and eh_membro(c.organizacao_id)))
  with check (exists (select 1 from contato c where c.id = contato_id and eh_membro(c.organizacao_id)));
create policy app_lista on lista for all to conecta_app
  using (eh_membro(organizacao_id)) with check (eh_membro(organizacao_id));
create policy app_lista_item on lista_item for all to conecta_app
  using (exists (select 1 from lista l where l.id = lista_id and eh_membro(l.organizacao_id)))
  with check (exists (select 1 from lista l where l.id = lista_id and eh_membro(l.organizacao_id)));
create policy app_credito on credito_lancamento for all to conecta_app
  using (eh_membro(organizacao_id) or eh_operadora()) with check (eh_membro(organizacao_id) or eh_operadora());
create policy app_busca_job on busca_job for all to conecta_app
  using (eh_membro(organizacao_id)) with check (eh_membro(organizacao_id));
create policy app_convite on convite for all to conecta_app
  using (eh_membro(organizacao_id) or eh_operadora()) with check (eh_membro(organizacao_id) or eh_operadora());
create policy app_auditoria on auditoria for all to conecta_app
  using (eh_membro(organizacao_id) or eh_operadora() or organizacao_id is null)
  with check (organizacao_id is null or eh_membro(organizacao_id) or eh_operadora());
create policy app_sinal on sinal for all to conecta_app
  using (organizacao_id is null or eh_membro(organizacao_id))
  with check (organizacao_id is null or eh_membro(organizacao_id));

-- Dados compartilhados entre organizações por desenho (cache de empresas, pool de buscas, base comum,
-- base da Receita) e tabelas internas do servidor (opt-out, limites, operadora): o app acessa sem filtro de organização.
do $$
declare t text;
begin
  foreach t in array array[
    'empresa_cache', 'pool_busca', 'base_empresa_info', 'base_contato', 'rf_estabelecimento', 'rf_cnae',
    'opt_out', 'limite_pedido', 'optout_pedido', 'operadora'
  ] loop
    execute format('create policy app_interno on %I for all to conecta_app using (true) with check (true)', t);
  end loop;
end $$;

-- Opt-out: apaga os dados da pessoa em TODAS as organizações. Como atravessa organizações, roda como dono
-- do banco (security definer) em vez de dar ao app acesso irrestrito aos contatos.
create or replace function aplicar_opt_out(p_email text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(p_email));
  ids uuid[];
begin
  insert into opt_out (email) values (e) on conflict do nothing;
  with apagados as (
    update contato_dado set email = null, telefone = null where lower(email) = e returning contato_id
  ) select coalesce(array_agg(contato_id), '{}') into ids from apagados;
  update contato set tem_email = false, tem_telefone = false where id = any(ids);
  update pool_busca set contatos = (
      select coalesce(jsonb_agg(c) filter (where lower(coalesce(c->>'email', '')) <> e), '[]'::jsonb)
        from jsonb_array_elements(contatos) c)
    where contatos::text ilike '%' || e || '%';
  delete from base_contato where lower(email) = e;
  return coalesce(array_length(ids, 1), 0);
end $$;
revoke all on function aplicar_opt_out(text) from public;
grant execute on function aplicar_opt_out(text) to conecta_app;
