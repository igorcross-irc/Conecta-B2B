import type { PGlite } from "@electric-sql/pglite";
import { ORG_DEMO, USUARIO_DEMO, abrirBancoLocal } from "./local";

/** O mínimo que os serviços precisam de um banco. PGlite e este adaptador de Postgres o cumprem. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Abre o banco: Postgres remoto (Neon, Supabase etc.) quando DATABASE_URL existir;
 * senão o banco local embutido (pasta .dados).
 * A URL é segredo: fica só em .env.local, nunca no repositório.
 */
export async function abrirBanco(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (!url) return abrirBancoLocal() as Promise<PGlite>;

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: true } });
  const db: Db = {
    // Cada consulta roda numa transação que declara quem é o usuário (auth.uid() das funções do banco).
    // Funciona também atrás de pooler em modo transação, que não mantém configurações de sessão.
    async query<T>(sql: string, params: unknown[] = []) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('request.jwt.sub', $1, true)", [USUARIO_DEMO]);
        const r = await client.query(sql, params);
        await client.query("commit");
        return { rows: r.rows as T[] };
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
  await garantirDemo(db);
  return db;
}

/** Cria, se faltar, o usuário, a organização e os créditos de demonstração. Idempotente. */
async function garantirDemo(db: Db, saldoInicial = 20): Promise<void> {
  await db.query(
    `insert into neon_auth."user" (id, name, email, "emailVerified")
     values ($1, 'Usuário de demonstração', 'demo@conecta-b2b.invalid', false)
     on conflict (id) do nothing`,
    [USUARIO_DEMO],
  );
  await db.query(
    `insert into organizacao (id, nome) values ($1, 'Organização de demonstração') on conflict (id) do nothing`,
    [ORG_DEMO],
  );
  await db.query(
    `insert into membro values ($1, $2, 'administrador') on conflict do nothing`,
    [ORG_DEMO, USUARIO_DEMO],
  );
  await db.query(`insert into config_tenant (organizacao_id) values ($1) on conflict do nothing`, [ORG_DEMO]);
  await db.query(
    `insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
     select $1, 'recarga', $2::int, $2::int, 'Créditos iniciais de demonstração'
      where not exists (select 1 from credito_lancamento where organizacao_id = $1)`,
    [ORG_DEMO, saldoInicial],
  );
}
