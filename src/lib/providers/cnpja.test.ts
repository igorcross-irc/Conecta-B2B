import { describe, expect, it } from "vitest";
import { CnpjaAberta, mapearCnpja } from "./cnpja";

// Formato lido de uma resposta real da API aberta (21/10/2026); nomes de pessoas omitidos.
const resposta = {
  taxId: "33000167000101",
  alias: "Petrobras - Edise",
  status: { id: 2, text: "Ativa" },
  company: {
    name: "PETROLEO BRASILEIRO S A PETROBRAS",
    equity: 205431960490.52,
    nature: { id: 2038, text: "Sociedade de Economia Mista" },
    size: { id: 5, acronym: "DEMAIS", text: "Demais" },
    members: [{ person: { name: "[MASKED]" }, role: { id: 10, text: "Diretor" } }],
  },
  address: { city: "Rio de Janeiro", state: "RJ" },
  phones: [{ type: "LANDLINE", area: "21", number: "21660000" }],
  emails: [
    { ownership: "CORPORATE", address: "cc-rfisc@petrobras.com.br", domain: "petrobras.com.br" },
  ],
  mainActivity: { id: 600001, text: "Extração de petróleo e gás natural" },
};

describe("mapearCnpja", () => {
  it("converte para o modelo interno", () => {
    const e = mapearCnpja(resposta, new Date("2026-10-21T12:00:00Z"));
    expect(e.razaoSocial).toBe("PETROLEO BRASILEIRO S A PETROBRAS");
    expect(e.situacao).toBe("Ativa");
    expect(e.municipio).toBe("Rio de Janeiro");
    expect(e.uf).toBe("RJ");
    expect(e.dominio).toBe("petrobras.com.br");
    expect(e.telefones).toEqual(["(21) 21660000"]);
    expect(e.socios[0].qualificacao).toBe("Diretor");
    expect(e.cnaePrincipal?.codigo).toBe(600001);
    expect(e.obtidoEm).toBe("2026-10-21T12:00:00.000Z");
  });

  it("tolera campos ausentes", () => {
    const e = mapearCnpja({ taxId: "1" });
    expect(e.telefones).toEqual([]);
    expect(e.socios).toEqual([]);
    expect(e.situacao).toBe("Desconhecida");
  });
});

describe("CnpjaAberta", () => {
  const http = (status: number, corpo: unknown = {}) =>
    (async () =>
      new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch;

  it("rejeita CNPJ inválido sem chamar a rede", async () => {
    let chamou = false;
    const p = new CnpjaAberta((async () => {
      chamou = true;
      return new Response("{}");
    }) as unknown as typeof fetch);
    await expect(p.buscarPorCnpj("123")).rejects.toThrow("CNPJ inválido");
    expect(chamou).toBe(false);
  });

  it("devolve null em 404 e erro claro em 429", async () => {
    expect(await new CnpjaAberta(http(404)).buscarPorCnpj("33000167000101")).toBeNull();
    await expect(
      new CnpjaAberta(http(429)).buscarPorCnpj("33000167000101"),
    ).rejects.toThrow("5 por minuto");
  });

  it("mapeia resposta 200", async () => {
    const e = await new CnpjaAberta(http(200, resposta)).buscarPorCnpj("33000167000101");
    expect(e?.razaoSocial).toContain("PETROBRAS");
  });
});
