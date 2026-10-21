import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCnpj, somenteDigitos } from "./cnpj";

describe("cnpj", () => {
  it("remove pontuação", () => {
    expect(somenteDigitos("33.000.167/0001-01")).toBe("33000167000101");
  });

  it("aceita CNPJ válido com e sem pontuação", () => {
    expect(cnpjValido("33000167000101")).toBe(true);
    expect(cnpjValido("33.000.167/0001-01")).toBe(true);
  });

  it("rejeita dígito verificador errado, tamanho errado e sequências repetidas", () => {
    expect(cnpjValido("33000167000102")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cnpjValido("")).toBe(false);
  });

  it("formata", () => {
    expect(formatarCnpj("33000167000101")).toBe("33.000.167/0001-01");
    expect(formatarCnpj("abc")).toBe("abc");
  });
});
