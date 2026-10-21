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
  const ja = await db.query<{ existe: boolean }>(
    "select to_regclass('public.organizacao') is not null as existe",
  );
  if (!ja.rows[0].existe) {
    await db.exec(`
      create schema if not exists auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    `);
    await db.exec(
      readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf8"),
    );
    await db.exec(`
      insert into auth.users values ('${USUARIO_DEMO}');
      insert into organizacao (id, nome) values ('${ORG_DEMO}', 'Organização de demonstração');
      insert into membro values ('${ORG_DEMO}', '${USUARIO_DEMO}', 'administrador');
      insert into config_tenant (organizacao_id) values ('${ORG_DEMO}');
      insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
        values ('${ORG_DEMO}', 'recarga', ${saldoInicial}, ${saldoInicial}, 'Créditos iniciais de demonstração');
    `);
  }
  // Usuário "logado" desta sessão (as funções do banco usam auth.uid()).
  await db.query("select set_config('request.jwt.sub', $1, false)", [USUARIO_DEMO]);
  return db;
}
