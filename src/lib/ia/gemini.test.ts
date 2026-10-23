import { describe, expect, it } from "vitest";
import { escolherModelo, testarGemini } from "./gemini";

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
