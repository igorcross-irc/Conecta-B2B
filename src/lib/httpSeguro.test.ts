import { describe, expect, it } from "vitest";
import { enderecoPrivado, fetchSeguro, lookupSeguro } from "./httpSeguro";

describe("enderecoPrivado", () => {
  it("bloqueia redes internas, reservadas e IPv6 que embutem IPv4 interno", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.31.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "::", "fe80::1", "fd00::1", "ff02::1",
      "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "2002:7f00:1::",
    ]) expect(enderecoPrivado(ip), ip).toBe(true);
  });
  it("libera endereços públicos", () => {
    for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(enderecoPrivado(ip), ip).toBe(false);
    }
  });
  it("trata lixo como privado", () => {
    expect(enderecoPrivado("999.1.1.1")).toBe(true);
    expect(enderecoPrivado("abc")).toBe(true);
  });
});

describe("conexão segura", () => {
  it("recusa conectar quando o nome resolve para o próprio servidor", async () => {
    const r = await new Promise<Error | null>((ok) => lookupSeguro("localhost", {}, (e) => ok(e)));
    expect(r?.message).toMatch(/não permitido/i);
  });
  it("recusa HTTP e IP literal", async () => {
    await expect(fetchSeguro("http://exemplo.com.br/")).rejects.toThrow();
    await expect(fetchSeguro("https://127.0.0.1/")).rejects.toThrow();
  });
  it("não alcança localhost nem por nome", async () => {
    await expect(fetchSeguro("https://localhost:1/")).rejects.toThrow(/não permitido/i);
  });
});
