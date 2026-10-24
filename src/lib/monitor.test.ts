import { describe, expect, it } from "vitest";
import { estadoDaFonte, medir, monitorarContatos, monitorarEmpresa, type Execucao } from "./monitor";

const coletor = () => {
  const lista: Execucao[] = [];
  return { lista, registrar: async (e: Execucao) => void lista.push(e) };
};

/* eslint-disable @typescript-eslint/no-unused-vars -- os provedores de teste ignoram o CNPJ, mas precisam aceitar o argumento */
describe("monitoramento de fontes", () => {
  it("registra sucesso com tempo e quantidade, e devolve o resultado", async () => {
    const c = coletor();
    const r = await medir("X", "contatos", async () => [1, 2, 3], c.registrar);
    expect(r).toEqual([1, 2, 3]);
    expect(c.lista[0]).toMatchObject({ provedor: "X", tipo: "contatos", ok: true, itens: 3 });
    expect(c.lista[0].ms).toBeGreaterThanOrEqual(0);
  });
  it("registra falha e relança o erro original", async () => {
    const c = coletor();
    await expect(medir("X", "empresa", async () => { throw new Error("fora do ar\ncom quebra"); }, c.registrar)).rejects.toThrow("fora do ar");
    expect(c.lista[0]).toMatchObject({ ok: false, erro: "fora do ar com quebra" });
  });
  it("falha ao gravar nunca derruba a chamada monitorada", async () => {
    const r = await medir("X", "ia", async () => "ok", async () => { throw new Error("banco caiu"); }, () => 1);
    expect(r).toBe("ok");
  });
  it("provedor de contatos: cada buscar vira um registro, o resto passa direto", async () => {
    const c = coletor();
    const p = monitorarContatos({ nome: "Site", extra: 7, buscar: async () => [{}, {}] }, c.registrar);
    expect(p.nome).toBe("Site");
    expect(p.extra).toBe(7);
    expect(await p.buscar()).toHaveLength(2);
    expect(c.lista).toMatchObject([{ provedor: "Site", tipo: "contatos", ok: true, itens: 2 }]);
  });
  it("provedor de empresa: 'não achou' é sucesso com 0 itens, erro é falha", async () => {
    const c = coletor();
    const achou = monitorarEmpresa({ nome: "A", buscarPorCnpj: async (_c: string) => ({ razao: "x" }) }, c.registrar);
    const naoAchou = monitorarEmpresa({ nome: "B", buscarPorCnpj: async (_c: string) => null }, c.registrar);
    const quebra = monitorarEmpresa({ nome: "C", buscarPorCnpj: async (_c: string) => { throw new Error("429"); } }, c.registrar);
    await achou.buscarPorCnpj("1");
    await naoAchou.buscarPorCnpj("1");
    await expect(quebra.buscarPorCnpj("1")).rejects.toThrow("429");
    expect(c.lista.map((e) => [e.provedor, e.ok, e.itens])).toEqual([["A", true, 1], ["B", true, 0], ["C", false, undefined]]);
  });
  it("semáforo", () => {
    expect(estadoDaFonte(0, 0)).toBe("sem_uso");
    expect(estadoDaFonte(100, 3)).toBe("ok");
    expect(estadoDaFonte(100, 20)).toBe("atencao");
    expect(estadoDaFonte(10, 5)).toBe("fora");
  });
});
