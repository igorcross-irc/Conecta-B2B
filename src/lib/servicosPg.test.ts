import { beforeEach, describe, expect, it } from "vitest";
import { abrirBancoLocal } from "@/db/local";
import { ProvedorDemo } from "./providers/mock";
import type { Empresa, ProvedorEmpresa } from "./providers/types";
import { ErroDeNegocio } from "./servicos";
import { criarServicosPg } from "./servicosPg";

const empresa: Empresa = {
  cnpj: "33000167000101",
  razaoSocial: "EMPRESA DE TESTE SA",
  situacao: "Ativa",
  telefones: [],
  emailsCadastrais: [],
  socios: [],
  fonte: "teste",
  obtidoEm: "2026-10-21T00:00:00Z",
};
const provedorEmpresa: ProvedorEmpresa = { nome: "teste", buscarPorCnpj: async () => empresa };

async function novo(saldo = 20) {
  const db = await abrirBancoLocal("memory://", saldo);
  return { db, s: criarServicosPg({ db, empresa: provedorEmpresa, contatos: [new ProvedorDemo()] }) };
}
const busca = (s: Awaited<ReturnType<typeof novo>>["s"], cargos: string[], chave: string) =>
  s.buscarDecisores({ cnpj: "33000167000101", cargos, chave });

describe("serviços em Postgres local", () => {
  let ctx: Awaited<ReturnType<typeof novo>>;
  beforeEach(async () => {
    ctx = await novo();
  });

  it("busca cobra 1, oculta dados e não cobra de novo com a mesma chave", async () => {
    const r = await busca(ctx.s, [], "k1");
    expect(r.saldo).toBe(19);
    expect(r.contatos[0].email).toBeUndefined();
    expect(r.contatos[0].emailMascarado).toMatch(/\*\*\*@/);
    expect((await busca(ctx.s, [], "k1")).saldo).toBe(19);
    expect((await ctx.db.query("select count(*) c from contato")).rows[0]).toEqual({ c: 3 });
  });

  it("estorna quando nada é encontrado", async () => {
    const r = await busca(ctx.s, ["cargo-que-nao-existe"], "k2");
    expect(r.contatos).toHaveLength(0);
    expect(r.saldo).toBe(20);
    expect((await ctx.s.extrato()).map((l) => l.operacao)).toContain("estorno");
  });

  it("revela uma vez só e cobra uma vez", async () => {
    const { contatos } = await busca(ctx.s, ["comercial"], "k3");
    const a = await ctx.s.revelar({ contatoId: contatos[0].id, campo: "email" });
    const b = await ctx.s.revelar({ contatoId: contatos[0].id, campo: "email" });
    expect(a.contato.email).toBe("pessoa.a@exemplo.com.br");
    expect(b.saldo).toBe(18);
  });

  it("não cobra dado inexistente nem contato inválido", async () => {
    const { contatos } = await busca(ctx.s, ["compras"], "k4");
    await expect(ctx.s.revelar({ contatoId: contatos[0].id, campo: "email" })).rejects.toMatchObject({ status: 404 });
    await expect(ctx.s.revelar({ contatoId: "nao-e-uuid", campo: "email" })).rejects.toBeInstanceOf(ErroDeNegocio);
    expect(await ctx.s.saldo()).toBe(19);
  });

  it("bloqueia sem saldo com status 402", async () => {
    const { s } = await novo(1);
    const { contatos } = await busca(s, ["comercial"], "k5");
    await expect(s.revelar({ contatoId: contatos[0].id, campo: "email" })).rejects.toMatchObject({ status: 402 });
  });

  it("listas e CSV: só leva o que foi revelado; opt-out vale em buscas futuras", async () => {
    const { contatos } = await busca(ctx.s, ["comercial"], "k6");
    const lista = await ctx.s.criarLista("Alimentos");
    await ctx.s.adicionarALista(lista.id, [contatos[0].id]);
    const l2 = await ctx.s.adicionarALista(lista.id, [contatos[0].id]);
    expect(l2.contatoIds).toHaveLength(1);
    expect(await ctx.s.exportarCsv(lista.id)).not.toContain("exemplo.com.br");
    await ctx.s.revelar({ contatoId: contatos[0].id, campo: "email" });
    expect(await ctx.s.exportarCsv(lista.id)).toContain("pessoa.a@exemplo.com.br");
    await ctx.s.registrarOptOut("PESSOA.A@exemplo.com.br");
    const r = await busca(ctx.s, ["comercial"], "k7");
    expect(r.contatos.find((c) => c.nome === "Pessoa Exemplo A")).toBeUndefined();
  });

  it("os dados persistem ao reabrir a mesma pasta", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "conecta-"));
    try {
      const db1 = await abrirBancoLocal(dir);
      const s1 = criarServicosPg({ db: db1, empresa: provedorEmpresa, contatos: [new ProvedorDemo()] });
      await busca(s1, [], "p1");
      await db1.close();
      const db2 = await abrirBancoLocal(dir);
      const s2 = criarServicosPg({ db: db2, empresa: provedorEmpresa, contatos: [new ProvedorDemo()] });
      expect(await s2.saldo()).toBe(19);
      await db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
