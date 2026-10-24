import { describe, expect, it } from "vitest";
import { verificarDominiosDeEmail, type ResolvedorMx } from "./mx";
import type { Contato } from "./types";

const c = (email: string, emailStatus: Contato["emailStatus"] = "nao_verificado"): Contato => ({
  nome: "Ana", cargo: "Diretora", email, emailStatus, origem: "t", obtidoEm: "2026-10-24T00:00:00Z", confianca: 0.5,
});

describe("verificação de domínio de e-mail", () => {
  const resolver: ResolvedorMx = async (d) => (d === "boa.com.br" ? "recebe" : d === "morta.com.br" ? "nao_recebe" : "indefinido");
  it("sobe o status se o domínio recebe e-mail, descarta se não recebe, e mantém se indefinido", async () => {
    const r = await verificarDominiosDeEmail([c("a@boa.com.br"), c("b@morta.com.br"), c("c@talvez.com.br")], resolver);
    expect(r[0].emailStatus).toBe("dominio_ok");
    expect(r[1].email).toBeUndefined();
    expect(r[1].emailStatus).toBeUndefined();
    expect(r[1].nome).toBe("Ana");
    expect(r[2]).toMatchObject({ email: "c@talvez.com.br", emailStatus: "nao_verificado" });
  });
  it("não rebaixa nem promove 'verificado' e 'inferido'; consulta cada domínio uma vez", async () => {
    let chamadas = 0;
    const contar: ResolvedorMx = async () => (chamadas++, "recebe");
    const r = await verificarDominiosDeEmail([c("a@x1.com.br", "verificado"), c("b@x1.com.br", "inferido"), c("c@x1.com.br")], contar);
    expect(r.map((x) => x.emailStatus)).toEqual(["verificado", "inferido", "dominio_ok"]);
    expect(chamadas).toBe(1);
  });
  it("contato sem e-mail passa direto, e erro do resolvedor não quebra", async () => {
    const sem = { ...c("x@y.com"), email: undefined, emailStatus: undefined };
    const r = await verificarDominiosDeEmail([sem, c("a@erro.com.br")], async () => { throw new Error("rede"); });
    expect(r[0]).toBe(sem);
    expect(r[1].email).toBe("a@erro.com.br");
  });
});
