import { describe, expect, it } from "vitest";
import { Razao } from "./credits";
import { ProvedorDemo } from "./providers/mock";
import type { Empresa, ProvedorEmpresa } from "./providers/types";
import { celulaCsv, criarServicos, ErroDeNegocio, mascararEmail } from "./servicos";

const empresa: Empresa = {
  cnpj: "33000167000101",
  razaoSocial: "EMPRESA DE TESTE SA",
  situacao: "Ativa",
  telefones: [],
  emailsCadastrais: [],
  socios: [],
  fonte: "teste",
  obtidoEm: "2026-10-21T00:00:00Z",
};
const provedorEmpresa: ProvedorEmpresa = {
  nome: "teste",
  async buscarPorCnpj() {
    return empresa;
  },
};

function novo(saldo = 20) {
  const razao = new Razao(saldo);
  const s = criarServicos({
    empresa: provedorEmpresa,
    contatos: [new ProvedorDemo()],
    razao,
  });
  return { s, razao };
}

describe("serviços", () => {
  it("busca decisores, cobra 1 crédito e oculta e-mail e telefone", async () => {
    const { s } = novo();
    const r = await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "k1" });
    expect(r.contatos.length).toBeGreaterThan(0);
    expect(r.saldo).toBe(19);
    const c = r.contatos[0];
    expect(c.email).toBeUndefined();
    expect(c.emailMascarado).toMatch(/\*\*\*@/);
    expect(c.telefone).toBeUndefined();
  });

  it("mesma chave de busca não cobra duas vezes", async () => {
    const { s } = novo();
    await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "k1" });
    const r = await s.buscarDecisores({ cnpj: "33000167000101", cargos: [], chave: "k1" });
    expect(r.saldo).toBe(19);
  });

  it("estorna a busca quando nada é encontrado", async () => {
    const { s, razao } = novo();
    const r = await s.buscarDecisores({
      cnpj: "33000167000101",
      cargos: ["cargo-que-nao-existe"],
      chave: "k2",
    });
    expect(r.contatos).toHaveLength(0);
    expect(r.saldo).toBe(20);
    expect(razao.extrato().map((l) => l.operacao)).toEqual(["estorno", "busca_decisores"]);
  });

  it("revela e-mail uma vez só e cobra uma vez", async () => {
    const { s } = novo();
    const { contatos } = await s.buscarDecisores({ cnpj: "33000167000101", cargos: ["comercial"], chave: "k3" });
    const id = contatos[0].id;
    const a = s.revelar({ contatoId: id, campo: "email" });
    const b = s.revelar({ contatoId: id, campo: "email" });
    expect(a.contato.email).toBe("pessoa.a@exemplo.com.br");
    expect(b.saldo).toBe(a.saldo);
    expect(a.saldo).toBe(18); // busca 1 + e-mail 1
  });

  it("não cobra por dado inexistente", async () => {
    const { s } = novo();
    const { contatos } = await s.buscarDecisores({ cnpj: "33000167000101", cargos: ["compras"], chave: "k4" });
    expect(() => s.revelar({ contatoId: contatos[0].id, campo: "email" })).toThrow(ErroDeNegocio);
    expect(s.saldo()).toBe(19);
  });

  it("bloqueia sem saldo e não revela", async () => {
    const { s } = novo(1);
    const { contatos } = await s.buscarDecisores({ cnpj: "33000167000101", cargos: ["comercial"], chave: "k5" });
    expect(() => s.revelar({ contatoId: contatos[0].id, campo: "email" })).toThrow(/insuficiente/);
  });

  it("rejeita CNPJ inválido", async () => {
    const { s } = novo();
    await expect(
      s.buscarDecisores({ cnpj: "123", cargos: [], chave: "k6" }),
    ).rejects.toThrow("CNPJ inválido");
  });

  it("lista guarda referências e o CSV só leva o que foi revelado", async () => {
    const { s } = novo();
    const { contatos } = await s.buscarDecisores({ cnpj: "33000167000101", cargos: ["comercial"], chave: "k7" });
    const lista = s.criarLista("Alimentos");
    s.adicionarALista(lista.id, [contatos[0].id]);
    s.adicionarALista(lista.id, [contatos[0].id]);
    expect(lista.contatoIds).toHaveLength(1);
    expect(s.exportarCsv(lista.id)).not.toContain("exemplo.com.br");
    s.revelar({ contatoId: contatos[0].id, campo: "email" });
    expect(s.exportarCsv(lista.id)).toContain("pessoa.a@exemplo.com.br");
  });

  it("opt-out impede o contato de voltar em buscas futuras", async () => {
    const { s } = novo();
    s.registrarOptOut("PESSOA.A@exemplo.com.br");
    const r = await s.buscarDecisores({ cnpj: "33000167000101", cargos: ["comercial"], chave: "k8" });
    expect(r.contatos.find((c) => c.nome === "Pessoa Exemplo A")).toBeUndefined();
  });
});

describe("utilitários", () => {
  it("mascara e-mail", () => {
    expect(mascararEmail("maria@empresa.com")).toBe("m***@empresa.com");
  });
  it("neutraliza fórmulas e escapa CSV", () => {
    expect(celulaCsv("=1+1")).toBe("'=1+1");
    expect(celulaCsv('a,"b"')).toBe('"a,""b"""');
  });
});
