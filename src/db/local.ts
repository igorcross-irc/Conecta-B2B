import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Banco local (Postgres embutido, PGlite) que roda a MESMA migração do Supabase.
 * Serve para desenvolver sem depender de vaga no plano gratuito do Supabase.
 * O schema `auth` é simulado só o suficiente para a migração funcionar.
 * Atenção: aqui a aplicação roda como superusuário (ignora RLS) e filtra por organização no código;
 * a segurança por linha só vale de verdade com Supabase + papéis reais.
 */
export const ORG_DEMO = "00000000-0000-0000-0000-0000000000d0";
export const USUARIO_DEMO = "00000000-0000-0000-0000-0000000000d1";

export async function abrirBancoLocal(
  dir: string = process.env.CONECTA_DADOS ?? ".dados",
  saldoInicial = 20,
): Promise<PGlite> {
  const db = new PGlite(dir);
  await db.waitReady;
  const ARQUIVOS = ["0001_init.sql", "0002_onboarding.sql", "0003_pool_e_buscas.sql", "0004_plataforma.sql", "0005_alvo_e_receita.sql", "0007_limite_e_optout.sql", "0008_papel_app.sql", "0009_pesquisas_salvas.sql", "0010_api_chaves.sql", "0011_enriquecimento.sql", "0012_municipios.sql", "0013_monitoramento.sql", "0014_perfil_ideal.sql", "0015_busca_palavras.sql"];
  const ja = await db.query<{ existe: boolean }>(
    "select to_regclass('public.organizacao') is not null as existe",
  );
  const novoBanco = !ja.rows[0].existe;
  if (novoBanco) {
    await db.exec(`
      create schema if not exists auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    `);
  }
  // Migrações são aplicadas uma vez cada; bancos criados antes do registro contam 0001 e 0002 como aplicadas.
  await db.exec("create table if not exists public._migracoes (arquivo text primary key)");
  if (!novoBanco) {
    await db.exec("insert into public._migracoes values ('0001_init.sql'), ('0002_onboarding.sql') on conflict do nothing");
  }
  for (const arquivo of ARQUIVOS) {
    const feita = await db.query("select 1 from public._migracoes where arquivo = $1", [arquivo]);
    if (feita.rows.length) continue;
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations", arquivo), "utf8"));
    await db.query("insert into public._migracoes values ($1)", [arquivo]);
  }
  if (novoBanco) {
    await db.exec(`
      insert into auth.users values ('${USUARIO_DEMO}');
      insert into organizacao (id, nome) values ('${ORG_DEMO}', 'Organização de demonstração');
      insert into membro values ('${ORG_DEMO}', '${USUARIO_DEMO}', 'administrador');
      insert into config_tenant (organizacao_id) values ('${ORG_DEMO}');
      insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
        values ('${ORG_DEMO}', 'recarga', ${saldoInicial}, ${saldoInicial}, 'Créditos iniciais de demonstração');
    `);
  }
  // Cadastro de nomes e e-mails dos usuários (no Neon vem do Neon Auth; aqui só o usuário de demonstração).
  await db.exec(`
    create schema if not exists neon_auth;
    create table if not exists neon_auth."user" (id uuid primary key, name text, email text, "emailVerified" boolean default false);
    insert into neon_auth."user" (id, name, email) values ('${USUARIO_DEMO}', 'Usuário de demonstração', 'demo@conecta-b2b.invalid')
      on conflict (id) do nothing;
  `);
  // O cadastro de usuários nasce depois das migrações aqui, então o papel limitado ganha a leitura agora.
  await db.exec(`grant usage on schema neon_auth to conecta_app; grant select on neon_auth."user" to conecta_app;`);
  await db.exec(`insert into operadora (usuario_id) values ('${USUARIO_DEMO}') on conflict do nothing`);
  // Usuário "logado" desta sessão (as funções do banco usam auth.uid()).
  await db.query("select set_config('request.jwt.sub', $1, false)", [USUARIO_DEMO]);
  return db;
}
