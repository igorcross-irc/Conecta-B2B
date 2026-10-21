import { describe, expect, it } from "vitest";
import { ProvedorDemo, EmpresaDemo } from "./providers/mock";
import type { ProvedorEmpresa } from "./providers/types";
import { executarTeste } from "./teste";

describe("executarTeste", () => {
  it("mede cobertura, trata CNPJ inválido e erro de provedor, e respeita a pausa", async () => {
    const pausas: number[] = [];
    let n = 0;
    const instavel: ProvedorEmpresa = {
      nome: "instável",
      async buscarPorCnpj(c) {
        if (++n === 2) throw new Error("429 limite");
        return new EmpresaDemo().buscarPorCnpj(c);
      },
    };
    const { linhas, resumo } = await executarTeste(
      [{ cnpj: "33000167000101", segmento: "a" }, { cnpj: "33000167000101" }, { cnpj: "123" }, { cnpj: "33000167000101" }],
      { empresa: instavel, contatos: [new ProvedorDemo()], pausaMs: 50, dormir: async (ms) => void pausas.push(ms), cargos: ["comercial"] },
    );
    expect(linhas.map((l) => l.empresa)).toEqual(["ok", "erro", "cnpj_invalido", "ok"]);
    expect(linhas[0]).toMatchObject({ decisores: 1, emailsVerificados: 1, comTelefone: 1, comLinkedin: 1, dominio: "exemplo.com.br" });
    expect(linhas[1].erro).toContain("429");
    expect(pausas).toEqual([50, 50]); // só entre consultas reais (não antes da 1ª nem do CNPJ inválido)
    expect(resumo).toMatchObject({ total: 4, empresasEncontradas: 2, comEmailVerificado: 2, emailsVerificadosTotal: 2 });
  });
});
