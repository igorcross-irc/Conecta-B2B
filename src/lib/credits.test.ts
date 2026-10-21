import { describe, expect, it } from "vitest";
import { Razao, SaldoInsuficienteError } from "./credits";

describe("Razao de créditos", () => {
  it("recarrega e cobra", () => {
    const r = new Razao(0);
    r.recarregar(10);
    const l = r.cobrar("revelar_email", 1, "E-mail de Fulano");
    expect(l.valor).toBe(-1);
    expect(r.saldoAtual).toBe(9);
  });

  it("não cobra além do saldo", () => {
    const r = new Razao(3);
    expect(() => r.cobrar("revelar_telefone", 5, "Telefone")).toThrow(
      SaldoInsuficienteError,
    );
    expect(r.saldoAtual).toBe(3);
  });

  it("mesma chave de idempotência não cobra duas vezes", () => {
    const r = new Razao(10);
    const a = r.cobrar("revelar_email", 1, "e-mail", "chave-1");
    const b = r.cobrar("revelar_email", 1, "e-mail", "chave-1");
    expect(b.id).toBe(a.id);
    expect(r.saldoAtual).toBe(9);
  });

  it("estorna uma vez só", () => {
    const r = new Razao(10);
    const c = r.cobrar("busca_decisores", 1, "busca");
    const e1 = r.estornar(c.id, "sem resultado");
    const e2 = r.estornar(c.id, "sem resultado");
    expect(e2.id).toBe(e1.id);
    expect(r.saldoAtual).toBe(10);
    expect(r.extrato()).toHaveLength(2);
  });

  it("não estorna o que não é cobrança", () => {
    const r = new Razao(0);
    const rec = r.recarregar(5);
    expect(() => r.estornar(rec.id, "x")).toThrow();
    expect(() => r.estornar("inexistente", "x")).toThrow();
  });

  it("rejeita valores inválidos", () => {
    const r = new Razao(5);
    expect(() => r.recarregar(0)).toThrow(RangeError);
    expect(() => r.cobrar("revelar_email", 0, "x")).toThrow(RangeError);
  });
});
