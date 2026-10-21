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

  it("usa os custos configurados no tenant", async () => {
    await ctx.db.query(
      `update config_tenant set custos = '{"busca_decisores":3,"revelar_email":2}'::jsonb`,
    );
    expect(await ctx.s.custos()).toEqual({ busca_decisores: 3, revelar_email: 2, revelar_telefone: 5 });
    const r = await busca(ctx.s, ["comercial"], "t1");
    expect(r.saldo).toBe(17);
    const rev = await ctx.s.revelar({ contatoId: r.contatos[0].id, campo: "email" });
    expect(rev.saldo).toBe(15);
  });

  it("organização sem vínculo com o usuário não consegue cobrar", async () => {
    const outra = "00000000-0000-0000-0000-0000000000e0";
    await ctx.db.query("insert into organizacao (id, nome) values ($1, 'Outra')", [outra]);
    await ctx.db.query("insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao) values ($1,'recarga',10,10,'x')", [outra]);
    const intruso = criarServicosPg({ db: ctx.db, empresa: provedorEmpresa, contatos: [new ProvedorDemo()], org: outra });
    await expect(busca(intruso, [], "i1")).rejects.toMatchObject({ status: 403 });
    expect(await intruso.saldo()).toBe(10);
  });

  it("importa CSV próprio sem cobrar, já revelado, e relata erros", async () => {
    const csv = [
      "CNPJ;Nome;Cargo;E-mail;Telefone",
      "33.000.167/0001-01;Ana Souza;Diretora Comercial;ana@cliente.com.br;(21) 98888-7777",
      "123;Sem Cnpj;Gerente;x@y.com;",
      "33000167000101;Bruno;;b@c.com;",
      "33000167000101;Carla;Compras;nao-e-email;",
      "33000167000101;Diego;Marketing;diego@cliente.com.br;",
    ].join("\n");
    await ctx.s.registrarOptOut("diego@cliente.com.br");
    const r = await ctx.s.importarContatos(csv);
    expect(r).toMatchObject({ importados: 1, ignorados: 1 });
    expect(r.erros).toHaveLength(3);
    expect(await ctx.s.saldo()).toBe(20);
    const lista = await ctx.s.criarLista("Meus");
    const ids = (await ctx.db.query<{ id: string }>("select id from contato")).rows.map((x) => x.id);
    await ctx.s.adicionarALista(lista.id, ids);
    expect(await ctx.s.exportarCsv(lista.id)).toContain("ana@cliente.com.br");
    await expect(ctx.s.importarContatos("a,b\n1,2")).rejects.toThrow(/colunas obrigatórias/);
  });

  it("opt-out apaga e-mail e telefone já guardados", async () => {
    await busca(ctx.s, ["comercial"], "o1");
    const r = await ctx.s.registrarOptOut("Pessoa.A@exemplo.com.br");
    expect(r.contatosAfetados).toBe(1);
    const d = await ctx.db.query<{ email: string | null }>("select email from contato_dado where email is not null and lower(email) = 'pessoa.a@exemplo.com.br'");
    expect(d.rows).toHaveLength(0);
    await expect(ctx.s.registrarOptOut("invalido")).rejects.toThrow("E-mail inválido.");
  });

  it("registra e lista sinais por CNPJ", async () => {
    await ctx.s.registrarSinal({ cnpj: "33000167000101", tipo: "anuncio_radio", fonte: "monitor X", ocorridoEm: "2026-10-01T12:00:00Z", conteudo: { emissora: "Rádio Y" } });
    const sinais = await ctx.s.sinaisDoCnpj("33.000.167/0001-01");
    expect(sinais).toHaveLength(1);
    expect(sinais[0]).toMatchObject({ tipo: "anuncio_radio", fonte: "monitor X" });
    await expect(ctx.s.registrarSinal({ cnpj: "1", tipo: "a", fonte: "b", ocorridoEm: "2026-01-01" })).rejects.toThrow("CNPJ inválido.");
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
