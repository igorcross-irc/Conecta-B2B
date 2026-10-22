import { describe, expect, it } from "vitest";
import { criarLimite } from "./limite";

describe("criarLimite", () => {
  it("bloqueia após o máximo e libera depois da janela", () => {
    let t = 0;
    const l = criarLimite(2, 1000, () => t);
    expect(l.permitir("a")).toBe(true);
    expect(l.permitir("a")).toBe(true);
    expect(l.permitir("a")).toBe(false);
    expect(l.permitir("b")).toBe(true);
    t = 1001;
    expect(l.permitir("a")).toBe(true);
  });
});
