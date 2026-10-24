import { contexto, responderErro } from "@/lib/app";

export const maxDuration = 60;

/**
 * GET /api/empresa/enriquecimento?cnpj=33000167000101
 * Informações extras de fontes públicas (CVM, Wikidata, notícias, sanções). Sem custo em créditos; 120 consultas por hora por usuário.
 */
export async function GET(req: Request) {
  try {
    const { sessao, servicos } = await contexto();
    if (!(await servicos.permitirPedido(`enriquecimento:${sessao.usuarioId}`, 120, 3600))) {
      return Response.json({ erro: "Muitas consultas. Tente novamente mais tarde." }, { status: 429 });
    }
    return Response.json(await servicos.enriquecer(new URL(req.url).searchParams.get("cnpj") ?? ""));
  } catch (e) {
    return responderErro(e);
  }
}
