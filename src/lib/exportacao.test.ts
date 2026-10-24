import { describe, expect, it } from "vitest";
import { formatoValido, montarCsv } from "./exportacao";

const l = { nome: "Maria da Silva Souza", cargo: "Diretora", email: "maria@acme.com.br", telefone: "(21) 33334444", origem: "Site", empresa: "ACME, Indústria", site: "acme.com.br" };

describe("exportação para CRM", () => {
  it("HubSpot separa nome e sobrenome e usa os cabeçalhos do importador", () => {
    const [cab, linha] = montarCsv("hubspot", [l]).replace("﻿", "").split("\r\n");
    expect(cab).toBe("First Name,Last Name,Email,Phone Number,Job Title,Company Name,Website URL,LinkedIn");
    expect(linha).toBe('Maria,da Silva Souza,maria@acme.com.br,(21) 33334444,Diretora,"ACME, Indústria",acme.com.br,');
  });
  it("Pipedrive e RD Station usam seus próprios cabeçalhos", () => {
    expect(montarCsv("pipedrive", []).split("\r\n")[0]).toContain("Organization - Name");
    expect(montarCsv("rdstation", []).split("\r\n")[0]).toBe("﻿Nome,Email,Cargo,Empresa,Telefone,Website,LinkedIn");
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
