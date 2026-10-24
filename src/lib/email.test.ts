import { afterEach, describe, expect, it, vi } from "vitest";
import { emailConfigurado, enviarEmail } from "./email";

afterEach(() => vi.unstubAllEnvs());

describe("e-mail", () => {
  it("fica desligado sem chave", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailConfigurado()).toBe(false);
    await expect(enviarEmail({ para: "a@b.com", assunto: "x", texto: "y" })).rejects.toThrow(/configurado/);
  });
  it("envia pelo Resend com remetente e destinatário", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_REMETENTE", "Conecta <n@c.com>");
    let corpo: Record<string, unknown> = {};
    const http = (async (_u: string, init: RequestInit) => {
      corpo = JSON.parse(init.body as string);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await enviarEmail({ para: "a@b.com", assunto: "Oi", texto: "t" }, http);
    expect(corpo).toMatchObject({ from: "Conecta <n@c.com>", to: ["a@b.com"], subject: "Oi" });
  });
  it("propaga erro do provedor", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_REMETENTE", "n@c.com");
    const http = (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    await expect(enviarEmail({ para: "a@b.com", assunto: "x", texto: "y" }, http)).rejects.toThrow(/403/);
  });
});
