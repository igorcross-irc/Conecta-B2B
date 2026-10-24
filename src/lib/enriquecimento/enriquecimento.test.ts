import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { abrirBancoLocal } from "@/db/local";
import { contatoDeRi, indexarCvm } from "./cvm";
import { enriquecer } from "./index";
import { lerFeed } from "./noticias";
import { buscarSancoes, mapearSancao } from "./sancoes";
import { buscarWikidata, entidadeEhDaEmpresa, extrairWikidata, simplificarNome } from "./wikidata";

/** Fixtures são respostas reais (CVM, Wikidata e Google Notícias, consultadas em 24/10/2026). */
const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n));
const PETROBRAS = "33000167000101";

describe("CVM (cadastro real)", () => {
  const indice = indexarCvm(new TextDecoder("latin1").decode(fx("cvm-cad.csv")));
  it("acha a companhia pelo CNPJ e traz setor, controle e o Diretor de RI", () => {
    const p = indice.get(PETROBRAS)!;
    expect(p).toMatchObject({ nome: "PETROBRAS", situacao: "ATIVO", setor: "Petróleo e Gás", controleAcionario: "ESTATAL HOLDING" });
    expect(p.mercado).toBe("BOLSA");
    expect(p.responsavel?.cargo).toBe("Diretor de Relações com Investidores");
    expect(p.emails).toEqual(["petroinvest@petrobras.com.br", "acionistas@petrobras.com.br"]);
    expect(p.telefone).toBe("(21) 32241510");
  });
  it("o Diretor de RI vira contato institucional com origem e confiança", () => {
    const [c] = contatoDeRi(indice.get(PETROBRAS)!, "2026-10-24T00:00:00Z");
    expect(c).toMatchObject({ cargo: "Diretor de Relações com Investidores", departamento: "Relações com investidores", origem: expect.stringContaining("CVM") });
    expect(c.email).toBe("dfinri@petrobras.com.br"); // e-mail do próprio responsável, não o genérico da empresa
    expect(c.confianca).toBeGreaterThan(0.8);
  });
  it("CNPJ fora do cadastro e arquivo estranho não quebram", () => {
    expect(indice.get("00000000000191")).toBeUndefined();
    expect(indexarCvm("a;b\n1;2").size).toBe(0);
  });
});

describe("Wikidata (entidade real)", () => {
  const e = JSON.parse(fx("wikidata-q210047.json").toString());
  it("extrai funcionários, receita, fundação, site e LinkedIn com o ano de referência", () => {
    const w = extrairWikidata(e);
    expect(w).toMatchObject({ id: "Q210047", funcionarios: { valor: 52000, ano: 2020 }, receita: { valor: 88827000000, moeda: "USD", ano: 2018 }, fundadaEm: 1953 });
    expect(w.site).toContain("petrobras.com.br");
    expect(w.linkedin).toBe("https://www.linkedin.com/company/petrobras");
  });
  it("só aceita a entidade se o domínio ou o CNPJ coincidirem (evita homônimo)", () => {
    expect(entidadeEhDaEmpresa(e, PETROBRAS, "petrobras.com.br")).toBe(true);
    expect(entidadeEhDaEmpresa(e, PETROBRAS, "www.petrobras.com.br")).toBe(true);
    expect(entidadeEhDaEmpresa(e, PETROBRAS, "outra.com.br")).toBe(false);
    expect(entidadeEhDaEmpresa(e, PETROBRAS, undefined)).toBe(false);
    expect(entidadeEhDaEmpresa({ id: "Q1", claims: { P6204: [{ mainsnak: { datavalue: { value: "33.000.167/0001-01" } } }] } }, PETROBRAS)).toBe(true);
  });
  it("busca em duas chamadas e devolve só a entidade confirmada", async () => {
    const http = (async (u: string) =>
      String(u).includes("wbsearchentities")
        ? new Response(JSON.stringify({ search: [{ id: "Q1" }, { id: "Q210047" }] }))
        : new Response(JSON.stringify({ entities: { Q1: { id: "Q1", claims: {} }, Q210047: e } }))) as unknown as typeof fetch;
    const w = await buscarWikidata({ cnpj: PETROBRAS, razaoSocial: "PETROLEO BRASILEIRO S A PETROBRAS", nomeFantasia: "Petrobras", dominio: "petrobras.com.br" }, http);
    expect(w?.id).toBe("Q210047");
    expect(await buscarWikidata({ cnpj: PETROBRAS, razaoSocial: "X", dominio: "sem-relacao.com" }, http)).toBeNull();
  });
  it("simplifica a razão social", () => {
    expect(simplificarNome("PETROLEO BRASILEIRO S A PETROBRAS")).toBe("PETROLEO BRASILEIRO PETROBRAS");
    expect(simplificarNome("PADARIA DO ZE LTDA ME")).toBe("PADARIA DO ZE");
  });
});

describe("Notícias (feed real)", () => {
  it("lê título, fonte, data e link; tira a fonte do título e não repete", () => {
    const n = lerFeed(fx("google-news.xml").toString("utf8"));
    expect(n.length).toBeGreaterThanOrEqual(2);
    expect(n[0].titulo).not.toMatch(/ - [^-]+$/);
    expect(n[0].fonte).toBeTruthy();
    expect(n[0].url).toMatch(/^https:\/\/news\.google\.com\//);
    expect(n[0].publicadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Set(n.map((x) => x.titulo)).size).toBe(n.length);
  });
  it("ignora item sem link seguro e decodifica entidades", () => {
    const xml = `<rss><channel><item><title>A &amp; B - Fonte</title><link>http://x.com/a</link></item>
      <item><title>Ok &quot;ótimo&quot; - Jornal</title><link>https://j.com/1</link><source url="https://j.com">Jornal</source></item></channel></rss>`;
    const n = lerFeed(xml);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ titulo: 'Ok "ótimo"', fonte: "Jornal" });
  });
});

describe("Sanções (CEIS/CNEP)", () => {
  it("mapeia o esquema do Portal da Transparência", () => {
    expect(
      mapearSancao("CEIS", {
        tipoSancao: { descricaoResumida: "Inidoneidade" }, orgaoSancionador: { nome: "CGU" }, dataInicioSancao: "01/01/2025",
        linkPublicacao: "javascript:alert(1)",
      }),
    ).toEqual({ cadastro: "CEIS", tipo: "Inidoneidade", orgao: "CGU", inicio: "01/01/2025", fim: undefined, link: undefined, multa: undefined });
  });
  it("consulta os dois cadastros com a chave no cabeçalho e trata recusa", async () => {
    const vistos: string[] = [];
    const http = (async (u: string, i: RequestInit) => {
      vistos.push(`${u} ${(i.headers as Record<string, string>)["chave-api-dados"]}`);
      return new Response(JSON.stringify(String(u).includes("/cnep") ? [{ valorMulta: "1000,00" }] : []));
    }) as unknown as typeof fetch;
    const r = await buscarSancoes(PETROBRAS, http, "tok");
    expect(r).toEqual([expect.objectContaining({ cadastro: "CNEP", multa: "1000,00" })]);
    expect(vistos[0]).toContain("/ceis?codigoSancionado=33000167000101&pagina=1 tok");
    await expect(buscarSancoes(PETROBRAS, (async () => new Response("", { status: 401 })) as unknown as typeof fetch, "x")).rejects.toThrow(/recusou/);
    await expect(buscarSancoes(PETROBRAS, http, "")).rejects.toThrow(/não configurado/);
  });
});

describe("enriquecer (agregador com cache)", () => {
  it("junta as fontes, guarda em cache, e uma fonte com erro não derruba as outras", async () => {
    const db = await abrirBancoLocal("memory://", 5);
    let chamadas = 0;
    const http = (async (u: string) => {
      chamadas++;
      const url = String(u);
      if (url.includes("cad_cia_aberta")) return new Response(fx("cvm-cad.csv"));
      if (url.includes("news.google")) return new Response("fora", { status: 503 });
      if (url.includes("wbsearchentities")) return new Response(JSON.stringify({ search: [{ id: "Q210047" }] }));
      return new Response(JSON.stringify({ entities: { Q210047: JSON.parse(fx("wikidata-q210047.json").toString()) } }));
    }) as unknown as typeof fetch;
    const alvo = { cnpj: PETROBRAS, razaoSocial: "PETROLEO BRASILEIRO S A PETROBRAS", nomeFantasia: "Petrobras", dominio: "petrobras.com.br" };
    const r = await enriquecer(db as never, alvo, { http });
    expect(r.cvm?.nome).toBe("PETROBRAS");
    expect(r.wikidata?.funcionarios?.valor).toBe(52000);
    expect(r.noticias).toBeUndefined();
    expect(r.erros.noticias).toMatch(/503/);
    expect(r.sancoes).toBeUndefined();
    const antes = chamadas;
    const r2 = await enriquecer(db as never, alvo, { http });
    expect(r2.cvm?.nome).toBe("PETROBRAS");
    // Segunda vez: CVM e Wikidata vêm do cache; só as notícias (que falharam e não ficaram em cache) são pedidas de novo.
    expect(chamadas - antes).toBe(1);
  });
});
