import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Valida a migração SQL num Postgres embutido (PGlite), simulando o que o Supabase fornece
 * (schema auth, auth.uid()) e um papel sem privilégios para exercitar a segurança por linha.
 */
const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
const USER_A = "00000000-0000-0000-0000-0000000000a1";
const USER_B = "00000000-0000-0000-0000-0000000000b1";
const CONTATO_A = "00000000-0000-0000-0000-0000000000c1";
const CONTATO_B = "00000000-0000-0000-0000-0000000000c2";

let db: PGlite;

async function como(usuario: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.sub', $1, false)", [usuario ?? ""]);
  await db.exec("set role cliente");
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    create role cliente;
  `);
  await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf8"));
  await db.exec(`
    grant usage on schema public, auth to cliente;
    grant select, insert, update, delete on all tables in schema public to cliente;
    grant execute on all functions in schema public to cliente;
    grant execute on function auth.uid() to cliente;

    insert into auth.users values ('${USER_A}'), ('${USER_B}');
    insert into organizacao (id, nome) values ('${ORG_A}', 'A'), ('${ORG_B}', 'B');
    insert into membro values ('${ORG_A}', '${USER_A}', 'administrador'), ('${ORG_B}', '${USER_B}', 'membro');
    insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao)
      values ('${ORG_A}', 'recarga', 10, 10, 'inicial'), ('${ORG_B}', 'recarga', 10, 10, 'inicial');
    insert into contato (id, organizacao_id, cnpj, nome, cargo, tem_email, tem_telefone, origem, obtido_em, confianca)
      values ('${CONTATO_A}', '${ORG_A}', '33000167000101', 'Pessoa A', 'Diretor', true, true, 'teste', now(), 0.9),
             ('${CONTATO_B}', '${ORG_B}', '33000167000101', 'Pessoa B', 'Diretor', true, false, 'teste', now(), 0.9);
    insert into contato_dado values ('${CONTATO_A}', 'a@exemplo.com.br', '(11) 90000-0001'),
                                    ('${CONTATO_B}', 'b@exemplo.com.br', null);
  `);
});

describe("migração 0001", () => {
  it("cada usuário só vê contatos da própria organização", async () => {
    await como(USER_A);
    const r = await db.query<{ nome: string }>("select nome from contato");
    expect(r.rows.map((x) => x.nome)).toEqual(["Pessoa A"]);
  });

  it("e-mail e telefone completos não são legíveis diretamente", async () => {
    await como(USER_A);
    const r = await db.query("select * from contato_dado");
    expect(r.rows).toHaveLength(0);
  });

  it("revelar cobra uma vez, é idempotente e devolve o dado", async () => {
    await como(USER_A);
    const a = await db.query<{ revelar_contato: string }>("select revelar_contato($1, 'email')", [CONTATO_A]);
    const b = await db.query<{ revelar_contato: string }>("select revelar_contato($1, 'email')", [CONTATO_A]);
    expect(a.rows[0].revelar_contato).toBe("a@exemplo.com.br");
    expect(b.rows[0].revelar_contato).toBe("a@exemplo.com.br");
    const s = await db.query<{ s: number }>("select saldo_creditos($1) as s", [ORG_A]);
    expect(s.rows[0].s).toBe(9);
  });

  it("não deixa revelar contato de outra organização", async () => {
    await como(USER_A);
    await expect(db.query("select revelar_contato($1, 'email')", [CONTATO_B])).rejects.toThrow();
  });

  it("dado inexistente não é cobrado", async () => {
    await como(USER_B);
    await expect(db.query("select revelar_contato($1, 'telefone')", [CONTATO_B])).rejects.toThrow(/nada foi cobrado/);
    const s = await db.query<{ s: number }>("select saldo_creditos($1) as s", [ORG_B]);
    expect(s.rows[0].s).toBe(10);
  });

  it("não cobra além do saldo e não grava lançamento", async () => {
    await como(USER_A);
    await expect(db.query("select cobrar_creditos($1, 'revelar_telefone', 50, 'x')", [ORG_A])).rejects.toThrow(/saldo insuficiente/);
    const s = await db.query<{ s: number }>("select saldo_creditos($1) as s", [ORG_A]);
    expect(s.rows[0].s).toBe(9);
  });

  it("estorno devolve o valor e só acontece uma vez", async () => {
    await como(USER_A);
    const c = await db.query<{ id: string }>("select id from cobrar_creditos($1, 'busca_decisores', 1, 'busca', 'k1')", [ORG_A]);
    await db.query("select estornar_creditos($1, $2, 'sem resultado')", [ORG_A, c.rows[0].id]);
    await db.query("select estornar_creditos($1, $2, 'sem resultado')", [ORG_A, c.rows[0].id]);
    const s = await db.query<{ s: number }>("select saldo_creditos($1) as s", [ORG_A]);
    expect(s.rows[0].s).toBe(9);
  });

  it("cliente não consegue inserir lançamento direto nem estourar o saldo", async () => {
    await como(USER_A);
    await expect(
      db.query(
        "insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao) values ($1, 'recarga', 1000, 1009, 'fraude')",
        [ORG_A],
      ),
    ).rejects.toThrow();
  });

  it("usuário anônimo não acessa nada", async () => {
    await como(null);
    const r = await db.query("select * from contato");
    expect(r.rows).toHaveLength(0);
  });
});
