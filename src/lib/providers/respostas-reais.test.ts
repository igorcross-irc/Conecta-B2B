import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BrasilApi, EmpresaEmCascata, mapearBrasilApi, minhaReceita } from "./brasilapi";
import { CnpjaAberta } from "./cnpja";

/**
 * Respostas REAIS das APIs (BrasilAPI e CNPJá aberta, consultadas em 24/10/2026 para a Petrobras, dado público),
 * guardadas como fixture para que uma mudança no formato quebre aqui e não em produção.
 * Para renovar: curl https://brasilapi.com.br/api/cnpj/v1/33000167000101 e https://open.cnpja.com/office/33000167000101.
 */
const lerFixture = (nome: string) => readFileSync(join(__dirname, "fixtures", nome), "utf8");
const resposta = (nome: string) => (async () => new Response(lerFixture(nome))) as unknown as typeof fetch;
const CNPJ = "33000167000101";

describe("BrasilAPI (resposta real)", () => {
  it("mapeia empresa, endereço, CNAE e sócios", async () => {
    const e = await new BrasilApi(resposta("brasilapi-petrobras.json")).buscarPorCnpj(CNPJ);
    expect(e).toMatchObject({
      cnpj: CNPJ, uf: "RJ", matriz: true, abertaEm: "1966-09-28", situacao: "ATIVA",
      cnaePrincipal: { codigo: 600001 }, endereco: { cep: "20031170" },
    });
    expect(e!.razaoSocial).toMatch(/PETROBRAS/);
    expect(e!.socios.length).toBeGreaterThan(0);
    expect(e!.socios[0]).toMatchObject({ qualificacao: expect.any(String), nome: expect.stringMatching(/\S/) });
    expect(e!.cnaesSecundarios!.length).toBeGreaterThan(0);
    expect(e!.telefones[0]).toMatch(/^\(\d{2}\) \d{8,9}$/);
  });
  it("é a mesma forma que o mapeador direto", () => {
    expect(mapearBrasilApi(JSON.parse(lerFixture("brasilapi-petrobras.json"))).cnpj).toBe(CNPJ);
  });
});

describe("CNPJá aberta (resposta real)", () => {
  it("mapeia empresa, domínio do e-mail cadastral, porte e sócios", async () => {
    const e = await new CnpjaAberta(resposta("cnpja-petrobras.json")).buscarPorCnpj(CNPJ);
    expect(e).toMatchObject({ cnpj: CNPJ, uf: "RJ", matriz: true, simples: false, mei: false, dominio: "petrobras.com.br" });
    expect(e!.emailsCadastrais).toContain("cc-rfisc@petrobras.com.br");
    expect(e!.socios.length).toBeGreaterThan(0);
    expect(e!.capitalSocial).toBeGreaterThan(1e9);
  });
});

describe("cascata com as duas respostas reais", () => {
  it("junta o melhor das duas fontes", async () => {
    const e = await new EmpresaEmCascata([
      new BrasilApi(resposta("brasilapi-petrobras.json")),
      new CnpjaAberta(resposta("cnpja-petrobras.json")),
    ]).buscarPorCnpj(CNPJ);
    expect(e!.dominio).toBe("petrobras.com.br");
    expect(e!.simples).toBe(false);
    expect(e!.socios.every((s) => !/masked/i.test(s.nome))).toBe(true);
  });
});

describe("Minha Receita (mesmo formato da BrasilAPI)", () => {
  it("lê a resposta real da BrasilAPI pelo mesmo mapeador e usa o endereço próprio", async () => {
    let visto = "";
    const http = (async (u: string) => { visto = u; return new Response(lerFixture("brasilapi-petrobras.json")); }) as unknown as typeof fetch;
    const e = await minhaReceita(http).buscarPorCnpj(CNPJ);
    expect(visto).toBe(`https://minhareceita.org/${CNPJ}`);
    expect(e).toMatchObject({ cnpj: CNPJ, uf: "RJ" });
  });
});
