import { describe, expect, it } from "vitest";
import { comTentativas, escolherModelo, gerarTexto, mensagemIA, testarGemini } from "./gemini";

describe("gemini", () => {
  it("prefere flash-lite mais novo e ignora variantes especiais", () => {
    expect(escolherModelo(["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3-flash-lite", "gemini-3-flash-image", "gemini-3-pro"])).toBe("gemini-3-flash-lite");
    expect(escolherModelo(["gemini-2.5-flash", "gemini-3-pro"])).toBe("gemini-2.5-flash");
    expect(escolherModelo(["x"], "models/meu")).toBe("meu");
  });
  it("sem chave explica o que fazer", async () => {
    delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
    const r = await testarGemini("oi");
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/GEMINI_API_KEY/);
  });
  it("fluxo completo com fetch simulado", async () => {
    process.env.GEMINI_API_KEY = "k";
    const f = (async (url: string) =>
      String(url).includes("generateContent")
        ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok!" }] } }] }))
        : new Response(JSON.stringify({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] }))) as unknown as typeof fetch;
    const r = await testarGemini("oi", f);
    expect(r).toMatchObject({ ok: true, modelo: "gemini-2.5-flash", resposta: "ok!" });
    delete process.env.GEMINI_API_KEY;
  });
});

describe("tentativas quando o Gemini está sobrecarregado", () => {
  it("repete em 503 e devolve o sucesso; no fim, mensagem amigável sem JSON cru", async () => {
    let n = 0;
    const ok = await comTentativas(async () => (++n < 3 ? new Response("x", { status: 503 }) : new Response("ok")), [1, 1]);
    expect(n).toBe(3);
    expect(await ok.text()).toBe("ok");
    n = 0;
    const falha = await comTentativas(async () => (n++, new Response("{ \"error\": 1 }", { status: 503 })), [1, 1]);
    expect(n).toBe(3);
    expect(falha.status).toBe(503);
    expect(mensagemIA("m", 503, "{ cru }")).toBe("A IA do Google está sobrecarregada agora (HTTP 503). Tente de novo em instantes.");
    expect(mensagemIA("m", 400, "ruim")).toContain("HTTP 400 ruim");
  });
  it("não repete erro definitivo (400)", async () => {
    let n = 0;
    await comTentativas(async () => (n++, new Response("x", { status: 400 })), [1, 1]);
    expect(n).toBe(1);
  });
  it("gerarTexto se recupera de um 503 passageiro", async () => {
    let n = 0;
    const f = (async () => (++n === 1 ? new Response("x", { status: 503 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "oi" }] } }] })))) as unknown as typeof fetch;
    expect(await gerarTexto("k", "m", "p", f)).toBe("oi");
    expect(n).toBe(2);
  });
});
