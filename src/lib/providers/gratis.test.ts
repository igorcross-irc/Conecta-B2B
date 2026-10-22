import { describe, expect, it } from "vitest";
import { BrasilApi, EmpresaEmCascata, mapearBrasilApi } from "./brasilapi";
import { SociosReceita } from "./socios";
import {
  SiteEmpresa, dominioSeguro, enderecoPrivado, extrairEmails, extrairTelefones, permitidoPorRobots,
} from "./site";
import type { Empresa } from "./types";

const empresa = (o: Partial<Empresa> = {}): Empresa => ({
  cnpj: "11222333000181", razaoSocial: "ACME", situacao: "Ativa", telefones: [], emailsCadastrais: [],
  socios: [], fonte: "teste", obtidoEm: "2026-10-22T00:00:00Z", ...o,
});

describe("BrasilAPI", () => {
  it("mapeia empresa, sócios e domínio (ignora e-mail de provedor aberto)", () => {
    const e = mapearBrasilApi({
      cnpj: "11222333000181", razao_social: "ACME LTDA", descricao_situacao_cadastral: "ATIVA",
      cnae_fiscal: 1091, cnae_fiscal_descricao: "Padaria", municipio: "NITEROI", uf: "RJ",
      ddd_telefone_1: "2133334444", email: "financeiro@acme.com.br",
      qsa: [{ nome_socio: "MARIA SILVA", qualificacao_socio: "Sócio-Administrador" }],
    });
    expect(e.dominio).toBe("acme.com.br");
    expect(e.telefones).toEqual(["(21) 33334444"]);
    expect(e.socios[0].nome).toBe("MARIA SILVA");
    expect(mapearBrasilApi({ cnpj: "1", email: "x@gmail.com" }).dominio).toBeUndefined();
  });

  it("trata 404 e 429", async () => {
    const f = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;
    expect(await new BrasilApi(f(404)).buscarPorCnpj("11222333000181")).toBeNull();
    await expect(new BrasilApi(f(429)).buscarPorCnpj("11222333000181")).rejects.toThrow(/Limite/);
  });

  it("em cascata, completa os sócios mascarados da CNPJá com os nomes da BrasilAPI", async () => {
    const mascarada = { nome: "a", buscarPorCnpj: async () => empresa({ socios: [{ nome: "[MASKED]", qualificacao: "Diretor" }] }) };
    const completa = { nome: "b", buscarPorCnpj: async () => empresa({ socios: [{ nome: "JOÃO", qualificacao: "Diretor" }], dominio: "acme.com.br" }) };
    const e = await new EmpresaEmCascata([mascarada, completa]).buscarPorCnpj("11222333000181");
    expect(e?.socios[0].nome).toBe("JOÃO");
    expect(e?.dominio).toBe("acme.com.br");
  });

  it("em cascata, sobrevive à falha de uma fonte", async () => {
    const quebrada = { nome: "a", buscarPorCnpj: async (): Promise<Empresa | null> => { throw new Error("fora"); } };
    const ok = { nome: "b", buscarPorCnpj: async () => empresa({ socios: [{ nome: "ANA", qualificacao: "Sócio" }] }) };
    expect((await new EmpresaEmCascata([quebrada, ok]).buscarPorCnpj("1"))?.razaoSocial).toBe("ACME");
  });
});

describe("SociosReceita", () => {
  it("devolve só quem decide e sem nome mascarado", async () => {
    const c = await new SociosReceita().buscar({
      cargos: [],
      empresa: empresa({ socios: [
        { nome: "MARIA", qualificacao: "Sócio-Administrador" },
        { nome: "[MASKED]", qualificacao: "Diretor" },
        { nome: "PEDRO", qualificacao: "Contador" },
      ] }),
    });
    expect(c.map((x) => x.nome)).toEqual(["MARIA"]);
    expect(c[0].origem).toMatch(/QSA/);
    expect(c[0].email).toBeUndefined();
  });
});

describe("site da empresa", () => {
  it("extrai só e-mails do domínio, inclusive escondidos pelo Cloudflare", () => {
    const k = 0x42;
    const hex = (s: string) => k.toString(16) + [...s].map((c) => (c.charCodeAt(0) ^ k).toString(16).padStart(2, "0")).join("");
    const html = `<a href="mailto:Vendas@acme.com.br">x</a> outro@gmail.com <a data-cfemail="${hex("diretoria@acme.com.br")}"></a> logo@acme.com.br.png`;
    expect(extrairEmails(html, "acme.com.br").sort()).toEqual(["diretoria@acme.com.br", "vendas@acme.com.br"]);
  });

  it("extrai telefones brasileiros", () => {
    expect(extrairTelefones("<p>Ligue (21) 99999-8888 ou 21 3333-4444</p>")).toEqual(["(21) 999998888", "(21) 33334444"]);
  });

  it("respeita robots.txt", () => {
    const r = "User-agent: *\nDisallow: /contato\nAllow: /contato/publico";
    expect(permitidoPorRobots(r, "/contato")).toBe(false);
    expect(permitidoPorRobots(r, "/contato/publico")).toBe(true);
    expect(permitidoPorRobots(r, "/sobre")).toBe(true);
  });

  it("bloqueia rede interna e domínios inválidos", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1"]) expect(enderecoPrivado(ip)).toBe(true);
    expect(enderecoPrivado("8.8.8.8")).toBe(false);
    expect(dominioSeguro("http://localhost")).toBeNull();
    expect(dominioSeguro("127.0.0.1")).toBeNull();
    expect(dominioSeguro("https://Acme.com.br/x")).toBe("acme.com.br");
  });

  it("não acessa host que resolve para endereço interno", async () => {
    let chamou = false;
    const http = (async () => { chamou = true; return new Response("x"); }) as unknown as typeof fetch;
    const p = new SiteEmpresa({ http, resolver: async () => ["10.0.0.1"] });
    expect(await p.buscar({ cargos: [], empresa: empresa({ dominio: "interno.com.br" }) })).toEqual([]);
    expect(chamou).toBe(false);
  });

  it("monta contatos a partir das páginas e marca origem e status", async () => {
    const paginas: Record<string, string> = {
      "/robots.txt": "User-agent: *\nDisallow: /privado",
      "/": "<html>Fale: contato@acme.com.br (21) 3333-4444</html>",
      "/equipe": "joana.souza@acme.com.br",
    };
    const http = (async (url: string) => {
      const caminho = new URL(url).pathname;
      return caminho in paginas
        ? new Response(paginas[caminho], { status: 200, headers: { "content-type": "text/html" } })
        : new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const c = await new SiteEmpresa({ http, resolver: async () => ["93.184.216.34"] })
      .buscar({ cargos: [], empresa: empresa({ dominio: "acme.com.br" }) });
    expect(c.map((x) => x.email).sort()).toEqual(["contato@acme.com.br", "joana.souza@acme.com.br"]);
    const geral = c.find((x) => x.email === "contato@acme.com.br")!;
    expect(geral.emailStatus).toBe("nao_verificado");
    expect(geral.origem).toMatch(/acme\.com\.br/);
    expect(geral.telefone).toBe("(21) 33334444");
  });
});
