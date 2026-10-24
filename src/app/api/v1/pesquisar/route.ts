import { responderErro, servicosPorChave } from "@/lib/app";
import { filtrosDaUrl } from "@/lib/consulta";

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
    return Response.json(await a.servicos.pesquisar(filtrosDaUrl(q)));
  } catch (e) {
    return responderErro(e);
  }
}
