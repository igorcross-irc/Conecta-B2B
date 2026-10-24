import { describe, expect, it } from "vitest";
import { formatoValido, montarCsv, montarCsvEmpresas } from "./exportacao";

const l = { cnpj: "33000167000101", nome: "Maria da Silva Souza", cargo: "Diretora", email: "maria@acme.com.br", telefone: "(21) 33334444", origem: "Site", empresa: "ACME, Indústria", site: "acme.com.br" };

describe("exportação para CRM", () => {
  it("HubSpot separa nome e sobrenome e usa os cabeçalhos do importador", () => {
    const [cab, linha] = montarCsv("hubspot", [l]).replace("﻿", "").split("\r\n");
    expect(cab).toBe("First Name,Last Name,Email,Phone Number,Job Title,Company Name,Website URL,LinkedIn,CNPJ");
    expect(linha).toBe('Maria,da Silva Souza,maria@acme.com.br,(21) 33334444,Diretora,"ACME, Indústria",acme.com.br,,33000167000101');
  });
  it("Pipedrive e RD Station usam seus próprios cabeçalhos", () => {
    expect(montarCsv("pipedrive", []).split("\r\n")[0]).toContain("Organization - Name");
    expect(montarCsv("rdstation", []).split("\r\n")[0]).toBe("﻿Nome,Email,Cargo,Empresa,Telefone,Website,LinkedIn,CNPJ");
  });
  it("protege contra fórmula de planilha e aceita campos ausentes", () => {
    const csv = montarCsv("padrao", [{ ...l, nome: "=HYPERLINK(\"x\")", email: undefined, telefone: undefined }]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
  });
  it("formato desconhecido cai no padrão", () => {
    expect(formatoValido("zoho")).toBe("padrao");
    expect(formatoValido("hubspot")).toBe("hubspot");
    expect(formatoValido(null)).toBe("padrao");
  });
});

describe("exportação de empresas", () => {
  const e = { cnpj: "33000167000101", razaoSocial: "ACME LTDA", nomeFantasia: "Acme, Padaria", uf: "RJ", municipio: "Niterói", bairro: "Icaraí", atividade: "Padaria", cnae: 4721102, porte: "Micro empresa", abertaEm: "2020-01-02", email: "x@acme.com.br", telefone: "2133334444", site: "acme.com.br" };
  it("cada formato usa os cabeçalhos de importação de empresa do destino", () => {
    expect(montarCsvEmpresas("hubspot", [e]).split("\r\n")[0]).toBe("\uFEFFCompany name,Company domain name,Phone Number,City,State/Region,Industry,Razão social,CNPJ");
    expect(montarCsvEmpresas("pipedrive", []).split("\r\n")[0]).toContain("Organization - Name");
    expect(montarCsvEmpresas("rdstation", []).split("\r\n")[0]).toContain("Segmento");
  });
  it("traz o CNPJ, escapa vírgula e protege contra fórmula", () => {
    const linha = montarCsvEmpresas("hubspot", [e, { ...e, nomeFantasia: "=SOMA(1)" }]).split("\r\n");
    expect(linha[1]).toBe('"Acme, Padaria",acme.com.br,2133334444,Niterói,RJ,Padaria,ACME LTDA,33000167000101');
    expect(linha[2].startsWith("\"'=SOMA(1)\"") || linha[2].startsWith("'=SOMA(1)")).toBe(true);
  });
  it("padrão leva todos os campos cadastrais", () => {
    expect(montarCsvEmpresas("padrao", [e]).split("\r\n")[1]).toContain("4721102,Micro empresa,2020-01-02,x@acme.com.br");
  });
});
