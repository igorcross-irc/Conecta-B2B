import type { PGlite } from "@electric-sql/pglite";
import { ORG_DEMO, USUARIO_DEMO, abrirBancoLocal } from "./local";

/** O mínimo que os serviços precisam de um banco. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Um banco que sabe rodar consultas em nome de um usuário (auth.uid() das funções SQL). */
export interface Banco {
  comUsuario(usuarioId: string): Db;
}

interface ClienteTx {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

const DECLARAR_USUARIO = "select set_config('request.jwt.sub', $1, true)";

/**
 * Abre o banco: Postgres remoto (Neon, Supabase etc.) quando DATABASE_URL existir;
 * senão o banco local embutido (pasta .dados).
 * A URL é segredo: fica só em .env.local, nunca no repositório.
 * Cada consulta roda numa transação que declara o usuário; funciona atrás de pooler em modo transação.
 */
export async function abrirBanco(): Promise<Banco> {
  const url = process.env.DATABASE_URL;
  let banco: Banco;

  if (!url) {
    const local: PGlite = await abrirBancoLocal();
    banco = {
      comUsuario: (usuarioId) => ({
        query: <T>(sql: string, params: unknown[] = []) =>
          local.transaction(async (tx) => {
            await tx.query(DECLARAR_USUARIO, [usuarioId]);
            return { rows: (await tx.query<T>(sql, params)).rows };
          }),
      }),
    };
  } else {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: true } });
    banco = {
      comUsuario: (usuarioId) => ({
        async query<T>(sql: string, params: unknown[] = []) {
          const client = await pool.connect();
          try {
            await client.query("begin");
            await client.query(DECLARAR_USUARIO, [usuarioId]);
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
      }),
    };
    // Dados de demonstração só existem sem login configurado; com login (produção) a base nasce limpa.
    if (!process.env.NEON_AUTH_BASE_URL) await garantirDemo(banco.comUsuario(USUARIO_DEMO));
  }
  return banco;
}

/** Cria, se faltar, o usuário, a organização e os créditos de demonstração. Idempotente. */
async function garantirDemo(db: Db, saldoInicial = 20): Promise<void> {
  const q: ClienteTx["query"] = (s, p) => db.query(s, p);
  await q(
    `insert into neon_auth."user" (id, name, email, "emailVerified")
     values ($1, 'Usuário de demonstração', 'demo@conecta-b2b.invalid', false)
     on conflict (id) do nothing`,
    [USUARIO_DEMO],
  );
  await q(`insert into organizacao (id, nome) values ($1, 'Organização de demonstração') on conflict (id) do nothing`, [ORG_DEMO]);
  await q(`insert into membro values ($1, $2, 'administrador') on conflict do nothing`, [ORG_DEMO, USUARIO_DEMO]);
  await q(`insert into config_tenant (organizacao_id) values ($1) on conflict do nothing`, [ORG_DEMO]);
  await q(
    `insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
     select $1, 'recarga', $2::int, $2::int, 'Créditos iniciais de demonstração'
      where not exists (select 1 from credito_lancamento where organizacao_id = $1)`,
    [ORG_DEMO, saldoInicial],
  );
}
