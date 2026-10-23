import { describe, expect, it } from "vitest";
import { classificarCargo } from "./cargos";
import { chaveDaPessoa, descobrirPadrao, inferirEmails, unirPessoas } from "./pessoas";
import type { Contato } from "./providers/types";

const c = (p: Partial<Contato>): Contato => ({ nome: "X Y", cargo: "c", origem: "A", obtidoEm: "2026-10-23", confianca: 0.5, ...p });

describe("cargos", () => {
  it("classifica senioridade e departamento", () => {
    expect(classificarCargo("Diretora Comercial")).toEqual({ senioridade: "Diretoria", departamento: "Vendas" });
    expect(classificarCargo("Sócio-Administrador")).toMatchObject({ senioridade: "Sócio / Fundador", departamento: "Geral" });
    expect(classificarCargo("CMO")).toMatchObject({ senioridade: "C-Level", departamento: "Marketing" });
    expect(classificarCargo("Gerente de Marketing e Mídia")).toEqual({ senioridade: "Gerência", departamento: "Marketing" });
    expect(classificarCargo("Coordenador de Logística")).toEqual({ senioridade: "Coordenação", departamento: "Operações" });
    expect(classificarCargo("Analista de RH")).toEqual({ senioridade: "Outros", departamento: "RH" });
  });
});

describe("pessoas", () => {
  it("reconhece a mesma pessoa ignorando acento, partículas e nome do meio", () => {
    expect(chaveDaPessoa("MARIA DA SILVA SANTOS")).toBe("maria santos");
    expect(chaveDaPessoa("Maria Santos")).toBe("maria santos");
    expect(chaveDaPessoa("João")).toBeNull();
  });

  it("une fontes, mantém o cargo específico e sobe a confiança", () => {
    const r = unirPessoas([
      c({ nome: "MARIA DA SILVA SANTOS", cargo: "Sócio-Administrador", origem: "Receita — QSA", confianca: 0.5 }),
      c({ nome: "Maria Santos", cargo: "Diretora Comercial", origem: "Busca web (https://x.com/a)", confianca: 0.45, linkedinUrl: "https://linkedin.com/in/maria" }),
      c({ nome: "Caixa contato (x.com)", cargo: "Caixa genérica", origem: "Site" }),
    ]);
    expect(r).toHaveLength(2);
    const m = r.find((x) => /maria/i.test(x.nome))!;
    expect(m.cargo).toBe("Sócio-Administrador");
    expect(m.linkedinUrl).toBe("https://linkedin.com/in/maria");
    expect(m.confianca).toBeCloseTo(0.65);
    expect(m.origem).toContain("Receita");
    expect(m.origem).toContain("Busca web");
  });

  it("descobre o padrão de e-mail e infere para quem não tem", () => {
    const lista = [
      c({ nome: "Maria Santos", email: "maria.santos@x.com.br", emailStatus: "verificado" }),
      c({ nome: "Pedro Alves Lima", cargo: "Diretor" }),
      c({ nome: "Ana", cargo: "Sócia" }),
    ];
    expect(descobrirPadrao(lista, "x.com.br")).toBe("{nome}.{sobrenome}");
    const r = inferirEmails(lista, "x.com.br");
    expect(r[1]).toMatchObject({ email: "pedro.lima@x.com.br", emailStatus: "inferido" });
    expect(r[2].email).toBeUndefined();
    expect(r[0].email).toBe("maria.santos@x.com.br");
    expect(inferirEmails(lista, undefined)).toBe(lista);
  });
});
