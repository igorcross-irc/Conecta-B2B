import { describe, expect, it } from "vitest";
import { buscarEmCascata } from "./cascade";
import type {
  Contato,
  Empresa,
  ProvedorContatos,
} from "./providers/types";

const empresa = { cnpj: "33000167000101" } as Empresa;
const entrada = { empresa, cargos: [] };

function contato(over: Partial<Contato>): Contato {
  return {
    nome: "Fulano",
    cargo: "Diretor",
    origem: "teste",
    obtidoEm: "2026-10-21T00:00:00Z",
    confianca: 0.5,
    ...over,
  };
}

const prov = (nome: string, contatos: Contato[] | Error): ProvedorContatos => ({
  nome,
  async buscar() {
    if (contatos instanceof Error) throw contatos;
    return contatos;
  },
});

describe("buscarEmCascata", () => {
  it("para quando há verificados suficientes e não consulta o provedor seguinte", async () => {
    let chamouB = false;
    const a = prov("A", [
      contato({ nome: "1", email: "1@x.com", emailStatus: "verificado" }),
      contato({ nome: "2", email: "2@x.com", emailStatus: "verificado" }),
    ]);
    const b: ProvedorContatos = {
      nome: "B",
      async buscar() {
        chamouB = true;
        return [];
      },
    };
    const r = await buscarEmCascata([a, b], entrada, { minimoVerificados: 2 });
    expect(chamouB).toBe(false);
    expect(r.contatos).toHaveLength(2);
  });

  it("segue para o próximo provedor e junta sem repetir, ficando com a maior confiança", async () => {
    const a = prov("A", [
      contato({ email: "a@x.com", emailStatus: "nao_verificado", confianca: 0.4 }),
    ]);
    const b = prov("B", [
      contato({ email: "A@x.com", emailStatus: "verificado", confianca: 0.9 }),
    ]);
    const r = await buscarEmCascata([a, b], entrada, { minimoVerificados: 5 });
    expect(r.contatos).toHaveLength(1);
    expect(r.contatos[0].confianca).toBe(0.9);
    expect(r.tentativas.map((t) => t.provedor)).toEqual(["A", "B"]);
  });

  it("falha de um provedor não derruba os outros", async () => {
    const a = prov("A", new Error("fora do ar"));
    const b = prov("B", [contato({ email: "b@x.com", emailStatus: "verificado" })]);
    const r = await buscarEmCascata([a, b], entrada, { minimoVerificados: 5 });
    expect(r.contatos).toHaveLength(1);
    expect(r.tentativas[0].erro).toBe("fora do ar");
  });

  it("descarta contatos em opt-out", async () => {
    const a = prov("A", [
      contato({ email: "sai@x.com", emailStatus: "verificado" }),
      contato({ email: "fica@x.com", emailStatus: "verificado" }),
    ]);
    const r = await buscarEmCascata([a], entrada, {
      optOut: (c) => c.email === "sai@x.com",
    });
    expect(r.contatos.map((c) => c.email)).toEqual(["fica@x.com"]);
  });
});
