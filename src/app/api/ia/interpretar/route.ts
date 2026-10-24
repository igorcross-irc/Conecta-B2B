import { contexto, responderErro } from "@/lib/app";
import { interpretarBusca } from "@/lib/ia/assistente";
import { chaveGemini } from "@/lib/ia/gemini";
import { ErroDeNegocio } from "@/lib/servicos";

/** POST /api/ia/interpretar  { texto }  -> filtros da pesquisa (validados contra listas fechadas). 30 por hora por usuário. */
export async function POST(req: Request) {
  try {
    const { sessao, servicos } = await contexto();
    if (!(await servicos.permitirPedido(`ia:${sessao.usuarioId}`, 30, 3600))) {
      return Response.json({ erro: "Muitos pedidos à IA. Tente novamente mais tarde." }, { status: 429 });
    }
    const { texto } = (await req.json()) as { texto?: string };
    try {
      return Response.json({ filtros: await interpretarBusca(texto ?? "") });
    } catch (e) {
      throw new ErroDeNegocio(e instanceof Error ? e.message : "A IA não respondeu.", chaveGemini() ? 502 : 503);
    }
  } catch (e) {
    return responderErro(e);
  }
}
