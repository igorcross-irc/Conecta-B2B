import { describe, expect, it } from "vitest";
import { BuscaWebPessoas, consultasDeBusca, nomeApareceNoTexto } from "./buscaweb";
import { Hunter } from "./hunter";
import type { Empresa } from "./types";

const empresa: Empresa = {
  cnpj: "33000167000101", razaoSocial: "ATACADAO SA", nomeFantasia: "Atacadão", situacao: "Ativa", municipio: "Rio de Janeiro", uf: "RJ",
  dominio: "atacadao.com.br", telefones: [], emailsCadastrais: [], socios: [], fonte: "t", obtidoEm: "2026-10-23",
};
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });

describe("Hunter", () => {
  it("converte e-mails em contatos com cargo, senioridade e LinkedIn", async () => {
    const http = (async () => json({ data: { emails: [
      { value: "Maria.Santos@atacadao.com.br", type: "personal", confidence: 92, first_name: "Maria", last_name: "Santos", position: "Diretora Comercial", linkedin: "linkedin.com/in/maria", verification: { status: "valid" } },
      { value: "contato@atacadao.com.br", type: "generic", confidence: 80 },
    ] } })) as unknown as typeof fetch;
    const r = await new Hunter("k", http).buscar({ empresa, cargos: [] });
    expect(r[0]).toMatchObject({ nome: "Maria Santos", email: "maria.santos@atacadao.com.br", emailStatus: "verificado", senioridade: "Diretoria", departamento: "Vendas", linkedinUrl: "https://linkedin.com/in/maria" });
    expect(r[1].cargo).toMatch(/genérica/);
  });
  it("erro claro quando a chave é inválida ou o limite acabou", async () => {
    const h = (s: number) => new Hunter("k", (async () => new Response("", { status: s })) as unknown as typeof fetch);
    await expect(h(401).buscar({ empresa, cargos: [] })).rejects.toThrow(/inválida/);
    await expect(h(429).buscar({ empresa, cargos: [] })).rejects.toThrow(/limite/);
  });
});

describe("busca na web + IA", () => {
  it("só aceita pessoas cujo nome aparece no trecho da fonte", () => {
    expect(nomeApareceNoTexto("Maria Santos", "Maria da Silva Santos é diretora")).toBe(true);
    expect(nomeApareceNoTexto("João Pereira", "Maria Santos é diretora")).toBe(false);
    expect(consultasDeBusca("Atacadão", "Rio")[0]).toContain("linkedin.com/in");
  });

  it("extrai pessoas, descarta invenções e guarda a origem", async () => {
    const http = (async (url: string) => {
      if (String(url).includes("tavily")) {
        return json({ results: [{ url: "https://exemplo.com/a", title: "Equipe", content: "Maria Santos, Diretora Comercial do Atacadão no Rio." }] });
      }
      if (String(url).includes("/models?")) return json({ models: [{ name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] }] });
      return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pessoas: [
        { nome: "Maria Santos", cargo: "Diretora Comercial", trecho: "x", url: "https://exemplo.com/a" },
        { nome: "Carlos Inventado", cargo: "CEO", trecho: "x", url: "https://exemplo.com/a" },
      ] }) }] } }] });
    }) as unknown as typeof fetch;
    const r = await new BuscaWebPessoas("t", "g", undefined, http).buscar({ empresa, cargos: [] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nome: "Maria Santos", cargo: "Diretora Comercial", senioridade: "Diretoria", departamento: "Vendas", origem: "Busca na web: https://exemplo.com/a" });
  });
});
