import { describe, expect, it } from "vitest";
import { cronAutorizado } from "./cron";
import { filtrosDaUrl, paraBusca } from "./consulta";

const f = (qs: string) => filtrosDaUrl(new URLSearchParams(qs));

describe("filtros da URL (um só tradutor para tela, exportação e API)", () => {
  it("lê os filtros conhecidos e ignora valores desconhecidos", () => {
    const r = f("nome=%20Padaria%20&uf=rjx&cidade=Niteroi&setor=varejo&setor=inexistente&porte=Demais&porte=Gigante&abertura=xx&email=1&telefone=0&filiais=1&ordem=recentes");
    expect(r).toMatchObject({ nome: "Padaria", uf: "RJ", cidade: "Niteroi", setores: ["varejo"], porte: ["Demais"], comEmail: true, comTelefone: false, incluirFiliais: true, ordem: "recentes", pagina: 0 });
    expect(r.abertura).toBeUndefined();
    expect(f("abertura=novas").abertura).toBe("novas");
  });
  it("valores vazios viram indefinido e a ordem padrão é por nome", () => {
    const r = f("nome=&uf=&ordem=qualquer");
    expect(r.nome).toBeUndefined();
    expect(r.uf).toBeUndefined();
    expect(r.ordem).toBe("nome");
    expect(f("ordem=aderencia").ordem).toBe("aderencia");
  });
  it("limita tamanhos e a página", () => {
    expect(f(`nome=${"a".repeat(500)}`).nome).toHaveLength(120);
    expect(f("pagina=-5").pagina).toBe(0);
    expect(f("pagina=abc").pagina).toBe(0);
    expect(f("pagina=2.9").pagina).toBe(2);
    expect(f("pagina=99999").pagina).toBe(399);
    expect(f(Array.from({ length: 80 }, () => "setor=varejo").join("&")).setores).toHaveLength(30);
  });
  it("searchParams do Next (valor repetido vira lista) dão o mesmo resultado que a URL", () => {
    const a = filtrosDaUrl(paraBusca({ setor: ["varejo", "ti"], uf: "sp", pagina: "3", nada: undefined }));
    expect(a).toEqual(f("setor=varejo&setor=ti&uf=sp&pagina=3"));
    expect(a.setores).toEqual(["varejo", "ti"]);
  });
});

describe("cron autorizado", () => {
  const req = (auth?: string) => new Request("https://x/api/cron", { headers: auth ? { authorization: auth } : {} });
  it("só aceita o segredo exato, e nunca quando o segredo não está definido", () => {
    delete process.env.CRON_SECRET;
    expect(cronAutorizado(req("Bearer "))).toBe(false);
    expect(cronAutorizado(req())).toBe(false);
    process.env.CRON_SECRET = "segredo-123";
    expect(cronAutorizado(req("Bearer segredo-123"))).toBe(true);
    expect(cronAutorizado(req("Bearer segredo-124"))).toBe(false);
    expect(cronAutorizado(req("segredo-123"))).toBe(false);
    expect(cronAutorizado(req())).toBe(false);
    delete process.env.CRON_SECRET;
  });
});
