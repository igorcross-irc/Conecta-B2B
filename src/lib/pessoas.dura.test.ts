import { describe, expect, it } from "vitest";
import { formatarNome, inferirEmails, mesmaPessoa, pareceEmpresa, unirPessoas } from "./pessoas";
import { SociosReceita } from "./providers/socios";
import { descreverOrigem, nivelDeConfianca } from "./origem";
import type { Contato, Empresa } from "./providers/types";

const c = (p: Partial<Contato>): Contato => ({ nome: "X Y", cargo: "Cargo", origem: "Fonte", obtidoEm: "2026-01-01T00:00:00Z", confianca: 0.5, ...p });

describe("mesma pessoa: sem juntar gente diferente", () => {
  it.each([
    ["João Pedro Silva", "João Paulo Silva", false],
    ["Ana Maria Souza", "Ana Clara Souza", false],
    ["João Silva", "João Pedro Silva", true],
    ["JOAO P SILVA", "João Pedro Silva", true],
    ["João Pedro Silva", "João Paulo Silva Neto", false],
    ["Maria da Silva", "Maria Silva", true],
    ["Maria de Sá", "Maria Sa", true],
    ["João", "João Silva", false],
    ["", "João Silva", false],
    ["Carlos Alberto Lima", "Carlos Eduardo Lima", false],
    ["Fernanda Lima", "Fernando Lima", false],
  ])("%s × %s => %s", (a, b, esperado) => {
    expect(mesmaPessoa(a, b)).toBe(esperado);
    expect(mesmaPessoa(b, a)).toBe(esperado); // simétrica
  });

  it("unirPessoas não funde homônimos parciais e não perde ninguém", () => {
    const r = unirPessoas([
      c({ nome: "JOAO PEDRO SILVA", cargo: "Sócio" }),
      c({ nome: "JOAO PAULO SILVA", cargo: "Sócio" }),
      c({ nome: "João Silva", cargo: "Diretor Comercial", origem: "Site x.com (página pública)", email: "joao@x.com" }),
    ]);
    // "João Silva" combina com os dois "João ? Silva": entra no primeiro grupo; os dois sócios continuam separados.
    expect(r).toHaveLength(2);
    expect(r.filter((x) => /pedro|paulo/i.test(x.nome))).toHaveLength(2);
    expect(r.some((x) => x.email === "joao@x.com")).toBe(true);
  });

  it("nunca perde e-mail nem telefone ao unir e é estável ao repetir", () => {
    const base = [
      c({ nome: "Maria Souza", email: "m@x.com", emailStatus: "verificado", origem: "Hunter.io (x.com)", confianca: 0.8 }),
      c({ nome: "MARIA DE SOUZA", telefone: "11999990000", origem: "Receita — QSA" }),
      c({ nome: "Maria S. Souza", linkedinUrl: "https://linkedin.com/in/m", origem: "Busca na web: https://a.com/x" }),
    ];
    const u = unirPessoas(base);
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ email: "m@x.com", emailStatus: "verificado", telefone: "11999990000", linkedinUrl: "https://linkedin.com/in/m" });
    expect(u[0].confianca).toBeLessThanOrEqual(0.95);
    expect(unirPessoas(u)).toEqual(u);
  });

  it("invariante aleatório: o número de pessoas nunca passa do de entradas e cada e-mail de entrada sobrevive", () => {
    const nomes = ["Ana Lima", "Ana Maria Lima", "Ana Paula Lima", "Bruno Costa", "BRUNO A COSTA", "Carla Dias", "Caio Dias"];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let rodada = 0; rodada < 200; rodada++) {
      const entrada = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) =>
        c({ nome: nomes[Math.floor(rnd() * nomes.length)], email: rnd() > 0.5 ? `p${rodada}${i}@x.com` : undefined, origem: rnd() > 0.5 ? "Hunter.io (x.com)" : "Receita — QSA" }),
      );
      const saida = unirPessoas(entrada);
      expect(saida.length).toBeLessThanOrEqual(entrada.length);
      const emailsSaida = new Set(saida.map((x) => x.email).filter(Boolean));
      // cada grupo guarda UM e-mail (o da base); nenhum e-mail aparece que não estava na entrada
      for (const e of emailsSaida) expect(entrada.some((x) => x.email === e)).toBe(true);
      expect(saida.every((x) => x.confianca <= 0.95)).toBe(true);
    }
  });
});

describe("sócio que é empresa não vira pessoa", () => {
  it.each([
    ["ITAU UNIBANCO HOLDING S.A.", true],
    ["FUNDO DE INVESTIMENTO EM PARTICIPACOES XYZ", true],
    ["PETROBRAS DISTRIBUIDORA S/A", true],
    ["ALFA COMERCIO E SERVICOS LTDA", true],
    ["12345678000199 EMPREENDIMENTOS", true],
    ["MARIA DE SÁ", false],
    ["JOSE DA SILVA", false],
    ["ANA PAULA SANTOS", false],
    ["CARLOS BANCO", true],
  ])("%s => empresa=%s", (nome, esperado) => expect(pareceEmpresa(nome)).toBe(esperado));

  it("SociosReceita só devolve pessoas com cargo de decisão, com nome legível", async () => {
    const empresa = {
      cnpj: "33000167000101", fonte: "BrasilAPI", obtidoEm: "2026-01-01T00:00:00Z", razaoSocial: "X", situacao: "ATIVA", telefones: [], emailsCadastrais: [],
      socios: [
        { nome: "MARIA DA SILVA", qualificacao: "Sócio-Administrador" },
        { nome: "BETA PARTICIPACOES S.A.", qualificacao: "Sócio" },
        { nome: "GAMA FUNDO", qualificacao: "Sócio", pessoaJuridica: true },
        { nome: "JOHN SMITH", qualificacao: "Sócio Pessoa Jurídica Domiciliado no Exterior" },
        { nome: "***123456**", qualificacao: "Sócio" },
        { nome: "[MASKED]", qualificacao: "Sócio" },
        { nome: "PEDRO LIMA", qualificacao: "Contador" },
        { nome: "ANA COSTA", qualificacao: "Diretor" },
      ],
    } as Empresa;
    const r = await new SociosReceita().buscar({ empresa, cargos: [] });
    expect(r.map((x) => x.nome)).toEqual(["Maria da Silva", "Ana Costa"]);
  });
});

describe("nomes legíveis", () => {
  it.each([
    ["MARIA DA SILVA", "Maria da Silva"],
    ["JOAO DOS SANTOS JUNIOR", "Joao dos Santos Junior"],
    ["Maria da Silva", "Maria da Silva"],
    ["  ANA   PAULA  ", "Ana Paula"],
    ["DE LUCA", "De Luca"],
  ])("%s => %s", (a, b) => expect(formatarNome(a)).toBe(b));
});

describe("e-mail adivinhado é sempre marcado como tal", () => {
  it("não sobrescreve e-mail existente, rebaixa a confiança e registra a origem", () => {
    const r = inferirEmails(
      [
        c({ nome: "Maria Souza", email: "maria.souza@x.com", emailStatus: "verificado", confianca: 0.9 }),
        c({ nome: "Pedro Lima", confianca: 0.5 }),
        c({ nome: "Caixa contato", confianca: 0.5 }),
        c({ nome: "João", confianca: 0.5 }),
      ],
      "x.com",
    );
    expect(r[0].email).toBe("maria.souza@x.com");
    expect(r[1]).toMatchObject({ email: "pedro.lima@x.com", emailStatus: "inferido" });
    expect(r[1].confianca).toBeLessThan(0.5);
    expect(r[1].origem).toContain("e-mail inferido");
    expect(r[2].email).toBeUndefined();
    expect(r[3].email).toBeUndefined();
  });
  it("sem nenhum e-mail conhecido no domínio, não inventa", () => {
    expect(inferirEmails([c({ nome: "Pedro Lima" })], "x.com")[0].email).toBeUndefined();
  });
});

describe("origem em palavras", () => {
  it("traduz cada produtor de origem do sistema", () => {
    expect(descreverOrigem("BrasilAPI — QSA")[0]).toMatchObject({ rotulo: "Sócio na Receita Federal", tom: "oficial" });
    expect(descreverOrigem("CVM (cadastro de companhia aberta)")[0].tom).toBe("oficial");
    expect(descreverOrigem("Busca na web: https://www.exemplo.com.br/equipe")[0].rotulo).toBe("Citado em exemplo.com.br");
    expect(descreverOrigem("Site exemplo.com.br (página pública)")[0].tom).toBe("site");
    expect(descreverOrigem("Hunter.io (exemplo.com.br)")[0].rotulo).toBe("Hunter.io");
    expect(descreverOrigem("demonstração (dados fictícios) + e-mail inferido pelo padrão {nome}.{sobrenome}@x.com").map((e) => e.tom)).toEqual(["demonstracao", "palpite"]);
  });
  it("base comum vira etiqueta própria, sem esconder a fonte original", () => {
    const e = descreverOrigem("Hunter.io (x.com) (base comum)");
    expect(e.map((x) => x.rotulo)).toEqual(["Hunter.io", "Base comum"]);
  });
  it("origem desconhecida aparece como está e duplicatas somem", () => {
    expect(descreverOrigem("Fonte Nova")[0].rotulo).toBe("Fonte Nova");
    expect(descreverOrigem("Hunter.io (a.com) + Hunter.io (b.com)")).toHaveLength(1);
    expect(descreverOrigem("")).toEqual([]);
  });
  it("confiança em palavras", () => {
    const duas = descreverOrigem("BrasilAPI — QSA + Site x.com (página pública)");
    expect(nivelDeConfianca(0.8, duas).nivel).toBe("alta");
    expect(nivelDeConfianca(0.8, duas).razao).toContain("Mais de uma fonte");
    expect(nivelDeConfianca(0.5, duas).nivel).toBe("media");
    expect(nivelDeConfianca(0.2, duas).nivel).toBe("baixa");
  });
});
