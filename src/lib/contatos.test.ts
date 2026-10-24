import { describe, expect, it } from "vitest";
import { celulaCsv, mascararEmail, mascararTelefone, visivel, type ContatoGuardado } from "./contatos";

const guardado = (extra: Partial<ContatoGuardado> = {}): ContatoGuardado => ({
  id: "c1",
  cnpj: "33000167000101",
  emailRevelado: false,
  telefoneRevelado: false,
  contato: { nome: "Ana Lima", cargo: "Diretora", email: "ana.lima@empresa.com", telefone: "(21) 99999-0000", origem: "teste", obtidoEm: "2026-01-01T00:00:00Z", confianca: 0.7 },
  ...extra,
});

describe("máscaras", () => {
  it.each([
    ["maria@empresa.com", "m***@empresa.com"],
    ["a@b.co", "a***@b.co"],
    ["semarroba", "***"],
    ["", "***"],
  ])("e-mail %s => %s", (a, b) => expect(mascararEmail(a)).toBe(b));
  it.each([
    ["(21) 99999-0000", "(21) *****-****"],
    ["21999990000", "(21) *****-****"],
    ["99999", "(99) *****-****"],
    ["abc", "*****-****"],
  ])("telefone %s => %s", (a, b) => expect(mascararTelefone(a)).toBe(b));
});

describe("o que o cliente vê", () => {
  it("antes de revelar, nunca expõe e-mail nem telefone completos (nem dentro de outros campos)", () => {
    const v = visivel(guardado());
    expect(v.email).toBeUndefined();
    expect(v.telefone).toBeUndefined();
    expect(v.emailMascarado).toBe("a***@empresa.com");
    expect(v.telefoneMascarado).toBe("(21) *****-****");
    expect(v.temEmail && v.temTelefone).toBe(true);
    expect(JSON.stringify(v)).not.toContain("ana.lima@empresa.com");
    expect(JSON.stringify(v)).not.toContain("99999-0000");
  });
  it("revela só o campo revelado, e cada um separadamente", () => {
    const so_email = visivel(guardado({ emailRevelado: true }));
    expect(so_email.email).toBe("ana.lima@empresa.com");
    expect(so_email.emailMascarado).toBeUndefined();
    expect(so_email.telefone).toBeUndefined();
    expect(JSON.stringify(so_email)).not.toContain("99999-0000");
    const so_tel = visivel(guardado({ telefoneRevelado: true }));
    expect(so_tel.telefone).toBe("(21) 99999-0000");
    expect(JSON.stringify(so_tel)).not.toContain("ana.lima@empresa.com");
  });
  it("sem e-mail ou telefone no contato, diz que não há (sem máscara falsa)", () => {
    const v = visivel(guardado({ contato: { ...guardado().contato, email: undefined, telefone: undefined } }));
    expect(v.temEmail).toBe(false);
    expect(v.temTelefone).toBe(false);
    expect(v.emailMascarado).toBeUndefined();
    expect(v.telefoneMascarado).toBeUndefined();
  });
});

describe("CSV seguro", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+cmd", "'+cmd"],
    ["-2", "'-2"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tx", "'\tx"],
    ['a,"b"', '"a,""b"""'],
    ["linha1\nlinha2", '"linha1\nlinha2"'],
    ["normal", "normal"],
  ])("%j => %j", (a, b) => expect(celulaCsv(a)).toBe(b));
  it("indefinido vira vazio", () => expect(celulaCsv(undefined)).toBe(""));
});
