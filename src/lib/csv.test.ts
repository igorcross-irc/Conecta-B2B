import { describe, expect, it } from "vitest";
import { lerCsv, normalizarCabecalho } from "./csv";

describe("lerCsv", () => {
  it("lê aspas, vírgulas internas e linhas em branco", () => {
    expect(lerCsv('a,b\n"x, y","z ""q"""\n\n1,2\n')).toEqual([["a", "b"], ["x, y", 'z "q"'], ["1", "2"]]);
  });
  it("detecta ponto e vírgula e BOM", () => {
    expect(lerCsv("﻿a;b\r\n1;2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("aceita quebra de linha dentro de aspas", () => {
    expect(lerCsv('a,b\n"x\ny",2')).toEqual([["a", "b"], ["x\ny", "2"]]);
  });
});

describe("normalizarCabecalho", () => {
  it("remove acento e símbolos", () => {
    expect(normalizarCabecalho("E-mail")).toBe("email");
    expect(normalizarCabecalho(" Razão Social ")).toBe("razaosocial");
  });
});
