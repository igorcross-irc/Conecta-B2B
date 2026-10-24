import { responderErro, servicosPorChave } from "@/lib/app";

export const maxDuration = 60;

/**
 * GET /api/v1/pesquisar?nome=&termos=&uf=&cidade=&bairro=&segmento=&setor=varejo&setor=...&porte=&abertura=&email=1&telefone=1&filiais=1&pagina=0
 * Mesmos filtros da tela Pesquisar. 25 empresas por página (sem custo).
 */
export async function GET(req: Request) {
  try {
    const a = await servicosPorChave(req);
    if ("erro" in a) return a.erro;
    const q = new URL(req.url).searchParams;
    const t = (k: string) => q.get(k) ?? undefined;
    return Response.json(
      await a.servicos.pesquisar({
        nome: t("nome"), termos: t("termos"), uf: t("uf"), cidade: t("cidade"), bairro: t("bairro"), segmento: t("segmento"),
        setores: q.getAll("setor"), porte: q.getAll("porte"), abertura: t("abertura"),
        comEmail: q.get("email") === "1", comTelefone: q.get("telefone") === "1",
        incluirFiliais: q.get("filiais") === "1", ordem: q.get("ordem") === "recentes" ? "recentes" : "nome",
        pagina: Number(q.get("pagina") ?? 0) || 0,
      }),
    );
  } catch (e) {
    return responderErro(e);
  }
}
