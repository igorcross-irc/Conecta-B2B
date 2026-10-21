-- Primeiro login: cria a organização do usuário (administrador) com configuração e créditos iniciais.
-- Idempotente e serializada por usuário. Só o próprio usuário (auth.uid()) pode criar a sua.
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
  insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
    values (org, 'recarga', p_creditos, p_creditos, 'Créditos iniciais');
  return org;
end $$;
