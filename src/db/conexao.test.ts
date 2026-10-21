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
  it("roda cada consulta numa transação com o usuário declarado", async () => {
    process.env.DATABASE_URL = "postgresql://x:y@host/db";
    const { abrirBanco } = await import("./conexao");
    const db = (await abrirBanco()).comUsuario("00000000-0000-0000-0000-0000000000d1");
    chamadas.length = 0;
    expect((await db.query("select 42 as x")).rows).toEqual([{ x: 42 }]);
    expect(chamadas).toEqual(["begin", "select set_config('request.jwt.sub',", "select 42", "commit", "release"]
      .map((c) => (c.startsWith("select set_config") ? "select set_config('request.jwt.sub'," : c)));
  });

  it("desfaz a transação e libera a conexão em caso de erro", async () => {
    process.env.DATABASE_URL = "postgresql://x:y@host/db";
    const { abrirBanco } = await import("./conexao");
    const db = (await abrirBanco()).comUsuario("00000000-0000-0000-0000-0000000000d1");
    chamadas.length = 0;
    await expect(db.query("select boom")).rejects.toThrow("falhou");
    expect(chamadas.slice(-2)).toEqual(["rollback", "release"]);
  });
});
