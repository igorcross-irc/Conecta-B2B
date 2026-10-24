import { beforeEach, describe, expect, it } from "vitest";
import { abrirBancoLocal, USUARIO_DEMO } from "@/db/local";
import { ProvedorDemo } from "./providers/mock";
import type { Empresa, ProvedorEmpresa } from "./providers/types";
import { ErroDeNegocio } from "./servicos";
import { criarServicosPg } from "./servicosPg";
import type { Db } from "@/db/conexao";
import type { PGlite } from "@electric-sql/pglite";

/**
 * Com CONECTA_TESTE_PAPEL=1 os serviços rodam como o papel limitado conecta_app (migração 0008), sem ignorar a
 * segurança por linha, e como o usuário de demonstração, igual à produção. Setup e conferências seguem como dono.
 */
function papel(db: PGlite, usuario: string = USUARIO_DEMO): Db {
  if (process.env.CONECTA_TESTE_PAPEL !== "1") return db as unknown as Db;
  return {
    query: <T,>(sql: string, params: unknown[] = []) =>
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.sub', $1, true)", [usuario]);
        await tx.exec("set local role conecta_app");
        return { rows: (await tx.query<T>(sql, params)).rows };
      }),
  };
}

const empresa: Empresa = {
  cnpj: "33000167000101",
  razaoSocial: "EMPRESA DE TESTE SA",
  situacao: "Ativa",
  telefones: [],
  emailsCadastrais: [],
  socios: [],
  fonte: "teste",
  obtidoEm: "2026-10-21T00:00:00Z",
  versao: 2,
};
const provedorEmpresa: ProvedorEmpresa = { nome: "teste", buscarPorCnpj: async () => empresa };

async function novo(saldo = 20) {
  const db = await abrirBancoLocal("memory://", saldo);
  return { db, s: criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [new ProvedorDemo()] }) };
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
    const intruso = criarServicosPg({ db: papel(ctx.db), empresa: provedorEmpresa, contatos: [new ProvedorDemo()], org: outra });
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
      const s1 = criarServicosPg({ db: papel(db1), empresa: provedorEmpresa, contatos: [new ProvedorDemo()] });
      await busca(s1, [], "p1");
      await db1.close();
      const db2 = await abrirBancoLocal(dir);
      const s2 = criarServicosPg({ db: papel(db2), empresa: provedorEmpresa, contatos: [new ProvedorDemo()] });
      expect(await s2.saldo()).toBe(19);
      await db2.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("pool compartilhado e busca em segundo plano", () => {
  const OUTRA_ORG = "00000000-0000-0000-0000-0000000000e0";

  it("a segunda busca (mesmas fontes e cargos) usa o pool e não consulta os provedores", async () => {
    let chamadas = 0;
    const contador = { nome: "contador", buscar: async () => { chamadas++; return new ProvedorDemo().buscar({ empresa, cargos: [] }); } };
    const db = await abrirBancoLocal("memory://", 20);
    const s = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [contador] });
    expect(await s.disponiveisNoPool("33000167000101")).toBe(0);
    await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "a" });
    expect(chamadas).toBe(1);
    expect(await s.disponiveisNoPool("33000167000101")).toBe(3);

    // Outra organização, com o mesmo banco: reaproveita o pool, mas paga o próprio crédito.
    await db.query("insert into organizacao (id, nome) values ($1, 'Outra')", [OUTRA_ORG]);
    await db.query("insert into config_tenant (organizacao_id) values ($1)", [OUTRA_ORG]);
    await db.query("insert into membro values ($1, $2, 'administrador')", [OUTRA_ORG, USUARIO_DEMO]);
    await db.query(
      "insert into credito_lancamento (organizacao_id, operacao, valor, saldo_apos, descricao) values ($1,'recarga',5,5,'x')",
      [OUTRA_ORG],
    );
    const s2 = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [contador], org: OUTRA_ORG });
    const r = await s2.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "b" });
    expect(chamadas).toBe(1);
    expect(r.contatos).toHaveLength(3);
    expect(r.saldo).toBe(4);
  });

  it("cargos diferentes ou fontes diferentes geram nova varredura", async () => {
    let chamadas = 0;
    const contador = { nome: "contador", buscar: async () => { chamadas++; return []; } };
    const db = await abrirBancoLocal("memory://", 20);
    const s = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [contador] });
    await s.buscarDecisores({ cnpj: "33000167000101", cargos: ["comercial"], chave: "a" });
    await s.buscarDecisores({ cnpj: "33000167000101", cargos: ["marketing"], chave: "b" });
    expect(chamadas).toBe(2);
    const s2 = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [{ ...contador, nome: "outra fonte" }] });
    await s2.buscarDecisores({ cnpj: "33000167000101", cargos: ["comercial"], chave: "c" });
    expect(chamadas).toBe(3);
  });

  it("falha total das fontes não vai para o pool", async () => {
    const quebrado = { nome: "q", buscar: async () => { throw new Error("fora do ar"); } };
    const db = await abrirBancoLocal("memory://", 20);
    const s = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [quebrado] });
    const r = await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "a" });
    expect(r.contatos).toHaveLength(0);
    expect(r.saldo).toBe(20);
    expect((await db.query("select count(*)::int c from pool_busca")).rows[0]).toEqual({ c: 0 });
  });

  it("busca em segundo plano: cobra, acompanha, conclui e é idempotente", async () => {
    const { s } = await novo();
    const inicio = await s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "j1" });
    expect(inicio.status).toBe("em_andamento");
    expect(await s.saldo()).toBe(19);
    // Mesma chave: devolve a mesma busca, sem cobrar de novo.
    expect((await s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "j1" })).id).toBe(inicio.id);
    expect(await s.saldo()).toBe(19);
    // Outra chave para a mesma empresa enquanto roda: bloqueada.
    await expect(s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "j2" })).rejects.toMatchObject({ status: 409 });

    await s.executarBusca(inicio.id);
    const fim = await s.statusBusca(inicio.id);
    expect(fim.status).toBe("concluida");
    expect(fim.contatos).toHaveLength(3);
    expect(fim.contatos![0].email).toBeUndefined();
    expect(fim.saldo).toBe(19);
    expect((await s.ultimaBusca("33000167000101"))?.id).toBe(inicio.id);
    // Concluída: nova busca da mesma empresa é permitida.
    expect((await s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "j3" })).status).toBe("em_andamento");
  });

  it("busca sem resultado devolve o crédito", async () => {
    const db = await abrirBancoLocal("memory://", 20);
    const s = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [{ nome: "vazio", buscar: async () => [] }] });
    const j = await s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "v" });
    await s.executarBusca(j.id);
    expect((await s.statusBusca(j.id)).status).toBe("concluida");
    expect(await s.saldo()).toBe(20);
  });

  it("busca perdida (sem sinal de vida) vira erro com estorno", async () => {
    const { db, s } = await novo();
    const j = await s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "p" });
    expect(await s.saldo()).toBe(19);
    await db.query("update busca_job set atualizado_em = now() - interval '10 minutes' where id = $1", [j.id]);
    const st = await s.statusBusca(j.id);
    expect(st.status).toBe("erro");
    expect(await s.saldo()).toBe(20);
  });

  it("sem saldo não deixa busca presa em andamento", async () => {
    const { s } = await novo(1);
    await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "gasto" });
    await expect(s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "z" })).rejects.toMatchObject({ status: 402 });
    // Pode tentar de novo (a busca anterior não ficou em andamento).
    await expect(s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "z2" })).rejects.toMatchObject({ status: 402 });
  });

  it("falha numa fonte durante a busca não derruba: o crédito volta se nada for achado", async () => {
    const db = await abrirBancoLocal("memory://", 20);
    const quebrada = { nome: "q", buscar: async () => { throw new Error("x"); } };
    const s = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [quebrada] });
    const j = await s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "f" });
    await s.executarBusca(j.id);
    expect(await s.saldo()).toBe(20);
  });

  it("opt-out limpa e-mail e telefone também no pool", async () => {
    const { db, s } = await novo();
    await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "o" });
    expect((await db.query("select contatos::text t from pool_busca")).rows[0]).toMatchObject({ t: expect.stringContaining("pessoa.a@exemplo.com.br") });
    await s.registrarOptOut("pessoa.a@exemplo.com.br");
    expect((await db.query("select contatos::text t from pool_busca")).rows[0]).toMatchObject({ t: expect.not.stringContaining("pessoa.a@exemplo.com.br") });
    // E uma nova busca a partir do pool também não devolve o e-mail.
    const r = await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "o2" });
    expect(r.contatos.some((c) => c.temEmail && c.emailMascarado?.includes("pessoa.a"))).toBe(false);
  });
});

describe("equipe, convites e acesso", () => {
  const OUTRO = "00000000-0000-0000-0000-0000000000f2";

  async function comOutroUsuario() {
    const { db, s } = await novo();
    await db.query("insert into auth.users values ($1)", [OUTRO]);
    await db.query(`insert into neon_auth."user" (id, name, email) values ($1, 'Outra Pessoa', 'outra@empresa.com.br')`, [OUTRO]);
    return { db, s };
  }
  const como = (db: Awaited<ReturnType<typeof novo>>["db"], u: string) =>
    db.query("select set_config('request.jwt.sub', $1, false)", [u]);

  it("convite por link: admin convida, outra pessoa aceita e entra com o papel combinado", async () => {
    const { db, s } = await comOutroUsuario();
    const token = await s.convidar("Outra@Empresa.com.br", "membro");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect((await s.equipe()).convites.map((c) => c.email)).toEqual(["outra@empresa.com.br"]);

    await como(db, OUTRO);
    const sOutro = criarServicosPg({ db: papel(db, OUTRO), empresa: provedorEmpresa, contatos: [], ator: { usuarioId: OUTRO, papel: "membro", operadora: false } });
    expect(await sOutro.aceitarConvite(token)).toBe("00000000-0000-0000-0000-0000000000d0");
    // Uso único.
    await expect(sOutro.aceitarConvite(token)).rejects.toMatchObject({ status: 404 });
    await expect(sOutro.aceitarConvite("naoexiste")).rejects.toMatchObject({ status: 404 });

    await como(db, USUARIO_DEMO);
    const eq = await s.equipe();
    expect(eq.convites).toHaveLength(0);
    expect(eq.membros.map((m) => [m.email, m.papel])).toContainEqual(["outra@empresa.com.br", "membro"]);
  });

  it("membro comum não administra a equipe", async () => {
    const { db } = await comOutroUsuario();
    const m = criarServicosPg({ db: papel(db, OUTRO), empresa: provedorEmpresa, contatos: [], ator: { usuarioId: OUTRO, papel: "membro", operadora: false } });
    await expect(m.convidar("a@b.com", "membro")).rejects.toMatchObject({ status: 403 });
    await expect(m.alterarPapel(OUTRO, "administrador")).rejects.toMatchObject({ status: 403 });
    await expect(m.renomearOrganizacao("x")).rejects.toMatchObject({ status: 403 });
    await expect(m.adminResumo()).rejects.toMatchObject({ status: 403 });
    await expect(m.adminRecarregar(OUTRO, 5, "x")).rejects.toMatchObject({ status: 403 });
  });

  it("não deixa a organização sem administrador", async () => {
    const { s } = await comOutroUsuario();
    await expect(s.alterarPapel(USUARIO_DEMO, "membro")).rejects.toMatchObject({ status: 409 });
    await expect(s.removerMembro(USUARIO_DEMO)).rejects.toMatchObject({ status: 409 });
  });

  it("promove, rebaixa e remove membros, e registra na auditoria", async () => {
    const { db, s } = await comOutroUsuario();
    await db.query("insert into membro values ($1, $2, 'membro')", ["00000000-0000-0000-0000-0000000000d0", OUTRO]);
    await s.alterarPapel(OUTRO, "administrador");
    await s.alterarPapel(USUARIO_DEMO, "membro"); // agora há outro administrador
    await s.removerMembro(USUARIO_DEMO);
    const acoes = (await criarServicosPg({ db: papel(db, OUTRO), empresa: provedorEmpresa, contatos: [], ator: { usuarioId: OUTRO, papel: "administrador", operadora: false } }).auditoriaRecente()).map((a) => a.acao);
    expect(acoes).toEqual(expect.arrayContaining(["equipe.papel", "equipe.remover"]));
  });

  it("operadora recarrega créditos e muda custos; valores inválidos são recusados", async () => {
    const { s } = await novo();
    const antes = await s.saldo();
    await s.adminRecarregar("00000000-0000-0000-0000-0000000000d0", 50, "teste");
    expect(await s.saldo()).toBe(antes + 50);
    await expect(s.adminRecarregar("00000000-0000-0000-0000-0000000000d0", -1, "x")).rejects.toThrow();
    await s.adminAtualizarCustos("00000000-0000-0000-0000-0000000000d0", { busca_decisores: 2, revelar_email: 3, revelar_telefone: 7 });
    expect((await s.custos()).busca_decisores).toBe(2);
    await expect(s.adminAtualizarCustos("00000000-0000-0000-0000-0000000000d0", { busca_decisores: 0, revelar_email: 1, revelar_telefone: 1 })).rejects.toThrow();
    const resumo = await s.adminResumo();
    expect(resumo.organizacoes).toBeGreaterThanOrEqual(1);
    expect((await s.adminOrganizacoes())[0].saldo).toBe(antes + 50);
  });
});

describe("base colaborativa", () => {
  it("empresa consultada fica na base compartilhada e a API pública não é chamada de novo", async () => {
    let chamadas = 0;
    const db = await abrirBancoLocal("memory://", 20);
    const s = criarServicosPg({ db: papel(db), empresa: { nome: "x", buscarPorCnpj: async () => { chamadas++; return empresa; } }, contatos: [] });
    await s.consultarEmpresa("33000167000101");
    await s.consultarEmpresa("33000167000101");
    expect(chamadas).toBe(1);
    const base = await s.listarBase({ q: "teste" });
    expect(base.total).toBe(1);
    expect(base.itens[0].razaoSocial).toBe("EMPRESA DE TESTE SA");
    expect((await s.listarBase({ q: "inexistente" })).total).toBe(0);
    expect((await s.listarBase({ uf: "SP" })).total).toBe(0);
  });

  it("correção de site vale para todos e descarta varreduras antigas", async () => {
    const { db, s } = await novo();
    await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "a" });
    expect((await db.query("select count(*)::int c from pool_busca")).rows[0]).toEqual({ c: 1 });
    await s.atualizarInfoEmpresa({ cnpj: "33000167000101", dominio: "https://www.Teste.com.br/contato", nota: "Matriz em SP", tags: ["Alimentos", "alimentos", "varejo"] });
    expect((await db.query("select count(*)::int c from pool_busca")).rows[0]).toEqual({ c: 0 });
    expect((await s.consultarEmpresa("33000167000101")).dominio).toBe("www.teste.com.br");
    const ficha = await s.fichaBase("33000167000101");
    expect(ficha.nota).toBe("Matriz em SP");
    expect(ficha.tags).toEqual(["alimentos", "varejo"]);
    await expect(s.atualizarInfoEmpresa({ cnpj: "33000167000101", dominio: "http://127.0.0.1" })).rejects.toThrow(/Site inválido/);
  });

  it("contato contribuído entra nas buscas de qualquer organização, e a prévia mostra só cargos", async () => {
    const { s } = await novo();
    await s.contribuirContato({ cnpj: "33000167000101", nome: "Joana Prado", cargo: "Diretora de Compras", email: "joana@teste.com.br", linkedinUrl: "https://www.linkedin.com/in/joana-prado" });
    await expect(s.contribuirContato({ cnpj: "33000167000101", nome: "X", cargo: "Y", linkedinUrl: "https://evil.com/in/x" })).rejects.toThrow(/LinkedIn/);
    const ficha = await s.fichaBase("33000167000101");
    expect(JSON.stringify(ficha)).not.toContain("Joana");
    expect(ficha.cargosDisponiveis).toContainEqual({ cargo: "Diretora de Compras", quantidade: 1 });
    expect(await s.disponiveisNoPool("33000167000101")).toBe(1);
    const r = await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "c" });
    const joana = r.contatos.find((c) => c.nome === "Joana Prado");
    expect(joana?.origem).toMatch(/base comum/);
    expect(joana?.email).toBeUndefined(); // continua oculto até pagar a revelação
  });

  it("opt-out também tira a pessoa da base comum e impede nova contribuição", async () => {
    const { s } = await novo();
    await s.contribuirContato({ cnpj: "33000167000101", nome: "Joana Prado", cargo: "Diretora", email: "joana@teste.com.br" });
    await s.registrarOptOut("joana@teste.com.br");
    expect(await s.disponiveisNoPool("33000167000101")).toBe(0);
    await expect(s.contribuirContato({ cnpj: "33000167000101", nome: "Joana", cargo: "Diretora", email: "joana@teste.com.br" })).rejects.toMatchObject({ status: 409 });
  });

  it("importação com 'compartilhar' envia à base comum; sem a opção, não", async () => {
    const { db, s } = await novo();
    const csv = "cnpj,nome,cargo,email\n33000167000101,Pedro Alves,Gerente,pedro@teste.com.br";
    await s.importarContatos(csv);
    expect((await db.query("select count(*)::int c from base_contato")).rows[0]).toEqual({ c: 0 });
    await s.importarContatos(csv, { compartilhar: true });
    expect((await db.query("select count(*)::int c from base_contato")).rows[0]).toEqual({ c: 1 });
  });

  it("buscas recentes listam a empresa pelo nome", async () => {
    const { s } = await novo();
    const j = await s.iniciarBusca({ cnpj: "33000167000101", cargos: [], chave: "r" });
    await s.executarBusca(j.id);
    expect((await s.buscasRecentes())[0]).toMatchObject({ empresa: "EMPRESA DE TESTE SA", status: "concluida" });
  });
});

describe("busca por site", () => {
  it("acha o CNPJ pelo site, associa na base e reaproveita depois sem visitar o site", async () => {
    const db = await abrirBancoLocal("memory://", 5);
    let visitas = 0;
    const s = criarServicosPg({
      db: papel(db), empresa: provedorEmpresa, contatos: [new ProvedorDemo()],
      descobridor: async () => { visitas++; return [{ cnpj: "33000167000101", ocorrencias: 2 }]; },
    });
    const r = await s.resolverSite("https://www.acme.com.br/contato");
    expect(r.dominio).toBe("acme.com.br");
    expect(r.origem).toBe("site");
    expect(r.candidatos.map((c) => c.cnpj)).toEqual(["33000167000101"]);
    await s.associarSite("33000167000101", "acme.com.br");
    const de_novo = await s.resolverSite("acme.com.br");
    expect(de_novo.origem).toBe("base");
    expect(visitas).toBe(1);
  });

  it("sem CNPJ no site, pede o CNPJ; site inválido é recusado", async () => {
    const db = await abrirBancoLocal("memory://", 5);
    const s = criarServicosPg({ db: papel(db), empresa: provedorEmpresa, contatos: [new ProvedorDemo()], descobridor: async () => [] });
    await expect(s.resolverSite("vazio.com.br")).rejects.toThrow(/CNPJ/);
    await expect(s.resolverSite("not a site")).rejects.toThrow(/inválido/);
  });
});

describe("alvo por site e pesquisa avançada", () => {
  it("pesquisa só pelo site, sem CNPJ, e roda a busca sobre ele", async () => {
    const { db, s } = await novo();
    const e = await s.consultarEmpresa("site:acme.com.br");
    expect(e).toMatchObject({ cnpj: "site:acme.com.br", dominio: "acme.com.br" });
    const j = await s.iniciarBusca({ cnpj: "site:acme.com.br", cargos: [], chave: "site1" }).catch((x) => x);
    expect(j).not.toBeInstanceOf(Error);
    expect((await db.query("select cnpj from busca_job")).rows[0]).toEqual({ cnpj: "site:acme.com.br" });
    await expect(s.consultarEmpresa("abc")).rejects.toThrow(/inválido/);
  });

  it("pesquisa por nome, UF, cidade, bairro e segmento", async () => {
    const { db, s } = await novo();
    await db.query(`insert into rf_cnae (codigo, descricao, busca) values (4639701, 'Comércio atacadista de produtos alimentícios', 'comercio atacadista de produtos alimenticios')`);
    await db.query(
      `insert into rf_estabelecimento (cnpj, razao_social, nome_fantasia, matriz, situacao, cnae, uf, municipio, bairro, busca) values
       ('33000167000101','ATACADAO SA','Atacadão',true,'ATIVA',4639701,'RJ','Rio de Janeiro','Barra da Tijuca','atacadao sa atacadao'),
       ('11222333000181','ATACADAO SA','Atacadão',false,'ATIVA',4639701,'SP','São Paulo','Mooca','atacadao sa atacadao'),
       ('00000000000191','PADARIA DO ZE','Pão Quente',true,'ATIVA',4721102,'RJ','Niterói','Icaraí','padaria do ze pao quente')`,
    );
    expect((await s.pesquisar({})).itens).toEqual([]);
    const a = await s.pesquisar({ nome: "Atacadão" });
    expect(a.itens.map((i) => i.cnpj)).toEqual(["33000167000101"]);
    expect((await s.pesquisar({ nome: "atacadao", incluirFiliais: true })).total).toBe(2);
    expect((await s.pesquisar({ nome: "atacadao", uf: "sp", incluirFiliais: true })).itens[0].cnpj).toBe("11222333000181");
    expect((await s.pesquisar({ cidade: "niteroi" })).itens[0].razaoSocial).toBe("PADARIA DO ZE");
    expect((await s.pesquisar({ bairro: "barra", segmento: "atacadista" })).total).toBe(1);
    expect((await s.pesquisar({ segmento: "4639701" })).total).toBe(1);
    expect((await s.pesquisar({ nome: "zzz" })).total).toBe(0);
  });
});

describe("pesquisa avançada: setor, porte, abertura e contato", () => {
  it("filtra por macro-setor, porte, tempo de abertura e e-mail/telefone", async () => {
    const { db, s } = await novo();
    await db.query(
      `insert into rf_estabelecimento (cnpj, razao_social, nome_fantasia, matriz, situacao, cnae, uf, municipio, bairro, porte, email, telefone, aberta_em, busca) values
       ('33000167000101','MERCADO A','Mercado A',true,'ATIVA',4711302,'RJ','Rio','Centro','Demais','a@m.com','2133334444', current_date - interval '20 years','mercado a'),
       ('11222333000181','CLINICA B','Clínica B',true,'ATIVA',8630503,'RJ','Rio','Centro','Micro empresa',null,null, current_date - interval '6 months','clinica b'),
       ('00000000000191','CLINICA C','Clínica C',true,'ATIVA',8630504,'RJ','Rio','Tijuca','Empresa de pequeno porte','c@c.com',null, current_date - interval '2 years','clinica c')`,
    );
    expect((await s.pesquisar({ setores: ["varejo"] })).itens.map((i) => i.cnpj)).toEqual(["33000167000101"]);
    expect((await s.pesquisar({ setores: ["saude"] })).total).toBe(2);
    expect((await s.pesquisar({ setores: ["saude"], porte: ["Micro empresa"] })).itens[0].razaoSocial).toBe("CLINICA B");
    expect((await s.pesquisar({ uf: "RJ", abertura: "novas" })).itens.map((i) => i.cnpj)).toEqual(["11222333000181"]);
    expect((await s.pesquisar({ uf: "RJ", abertura: "10mais" })).itens.map((i) => i.cnpj)).toEqual(["33000167000101"]);
    expect((await s.pesquisar({ uf: "RJ", comEmail: true })).total).toBe(2);
    expect((await s.pesquisar({ uf: "RJ", comTelefone: true })).total).toBe(1);
    const r = await s.pesquisar({ uf: "RJ", ordem: "recentes" });
    expect(r.itens[0]).toMatchObject({ razaoSocial: "CLINICA B", temEmail: false, temTelefone: false, matriz: true });
  });

  it("ficha se completa com a base da Receita e cai nela se a fonte externa falhar", async () => {
    const { db } = await novo();
    await db.query(
      `insert into rf_estabelecimento (cnpj, razao_social, nome_fantasia, matriz, situacao, cnae, uf, municipio, bairro, cep, porte, email, telefone, aberta_em, busca) values
       ('11222333000181','CLINICA B LTDA','Clínica B',true,'ATIVA',8630503,'RJ','Rio de Janeiro','Tijuca','20270000','Micro empresa','contato@clinicab.com.br','2133334444','2020-05-01','clinica b ltda clinica b')`,
    );
    const s2 = criarServicosPg({ db: papel(db), empresa: { nome: "x", buscarPorCnpj: async () => { throw new Error("limite"); } }, contatos: [new ProvedorDemo()] });
    const e = await s2.consultarEmpresa("11222333000181");
    expect(e).toMatchObject({ razaoSocial: "CLINICA B LTDA", municipio: "Rio de Janeiro", abertaEm: "2020-05-01", matriz: true });
    expect(e.endereco).toMatchObject({ bairro: "Tijuca", cep: "20270000" });
    expect(e.emailsCadastrais).toContain("contato@clinicab.com.br");
    expect(e.telefones).toContain("(21) 33334444");
  });
});

describe("opt-out com confirmação e limite de pedidos", () => {
  it("só apaga depois do token do e-mail, que vale uma vez", async () => {
    const { db, s } = await novo();
    const r = await busca(s, [], "k-opt");
    const contato = r.contatos[0];
    await s.revelar({ contatoId: contato.id, campo: "email" });
    const email = (await db.query<{ email: string }>("select email from contato_dado where email is not null limit 1")).rows[0].email;

    const token = await s.pedirOptOut(email);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // Antes de confirmar nada foi apagado, e o banco só guarda o hash.
    expect((await db.query("select 1 from opt_out where email = $1", [email.toLowerCase()])).rows).toHaveLength(0);
    expect((await db.query("select token_hash from optout_pedido")).rows[0]).not.toEqual({ token_hash: token });

    expect((await s.confirmarOptOut(token!)).contatosAfetados).toBeGreaterThan(0);
    expect((await db.query("select 1 from opt_out where email = $1", [email.toLowerCase()])).rows).toHaveLength(1);
    await expect(s.confirmarOptOut(token!)).rejects.toThrow(/inválido ou expirado/);
  });

  it("recusa token inválido, expirado e excesso de pedidos por e-mail", async () => {
    const { db, s } = await novo();
    await expect(s.confirmarOptOut("nope")).rejects.toThrow(/inválido/);
    const t = (await s.pedirOptOut("pessoa@empresa.com.br"))!;
    await db.query("update optout_pedido set expira_em = now() - interval '1 minute'");
    await expect(s.confirmarOptOut(t)).rejects.toThrow(/expirado/);
    await s.pedirOptOut("pessoa@empresa.com.br");
    await s.pedirOptOut("pessoa@empresa.com.br");
    expect(await s.pedirOptOut("pessoa@empresa.com.br")).toBeNull();
  });

  it("limite por chave conta no banco e libera depois da janela", async () => {
    const { db, s } = await novo();
    expect(await s.permitirPedido("ip:1", 2, 3600)).toBe(true);
    expect(await s.permitirPedido("ip:1", 2, 3600)).toBe(true);
    expect(await s.permitirPedido("ip:1", 2, 3600)).toBe(false);
    expect(await s.permitirPedido("ip:2", 2, 3600)).toBe(true);
    await db.query("update limite_pedido set criado_em = now() - interval '2 hours'");
    expect(await s.permitirPedido("ip:1", 2, 3600)).toBe(true);
  });
});
