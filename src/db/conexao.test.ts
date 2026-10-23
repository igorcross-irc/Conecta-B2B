import { afterEach, describe, expect, it, vi } from "vitest";

const chamadas: string[] = [];
vi.mock("pg", () => ({
  Pool: class {
    async connect() {
      return {
        query: async (sql: string) => {
          chamadas.push(sql.trim().split(/\s+/).slice(0, 2).join(" "));
          if (/^select 42/.test(sql)) return { rows: [{ x: 42 }] };
          if (/^select boom/.test(sql)) throw new Error("falhou");
          return { rows: [] };
        },
        release: () => chamadas.push("release"),
      };
    }
  },
}));

afterEach(() => {
  chamadas.length = 0;
  delete process.env.DATABASE_URL;
});

describe("abrirBanco com DATABASE_URL", () => {
  it("declara o usuário e roda a consulta em duas idas ao banco", async () => {
    process.env.DATABASE_URL = "postgresql://x:y@host/db";
    const { abrirBanco } = await import("./conexao");
    const db = (await abrirBanco()).comUsuario("00000000-0000-0000-0000-0000000000d1");
    chamadas.length = 0;
    expect((await db.query("select 42 as x")).rows).toEqual([{ x: 42 }]);
    expect(chamadas).toEqual(["select set_config('request.jwt.sub',", "select 42", "release"]);
  });

  it("libera a conexão em caso de erro e recusa identificador que não seja UUID", async () => {
    process.env.DATABASE_URL = "postgresql://x:y@host/db";
    const { abrirBanco } = await import("./conexao");
    const banco = await abrirBanco();
    chamadas.length = 0;
    await expect(banco.comUsuario("00000000-0000-0000-0000-0000000000d1").query("select boom")).rejects.toThrow("falhou");
    expect(chamadas.slice(-1)).toEqual(["release"]);
    await expect(banco.comUsuario("x'); drop table a;--").query("select 1")).rejects.toThrow(/inválido/);
  });
});
