import { contexto, registrarFonte, responderErro } from "@/lib/app";
import { medir } from "@/lib/monitor";
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
      return Response.json({ filtros: await medir("Gemini: busca em linguagem natural", "ia", () => interpretarBusca(texto ?? ""), registrarFonte, () => 1) });
    } catch (e) {
      // IA fora do ar: um texto curto (provavelmente um nome de empresa) vira busca por nome, em vez de travar a pessoa.
      const curto = (texto ?? "").trim();
      if (chaveGemini() && curto.length >= 2 && curto.length <= 60) {
        return Response.json({ filtros: { nome: curto }, aviso: "A IA está indisponível agora; busquei pelo nome. Use os filtros para refinar." });
      }
      throw new ErroDeNegocio(e instanceof Error ? e.message : "A IA não respondeu.", chaveGemini() ? 502 : 503);
    }
  } catch (e) {
    return responderErro(e);
  }
}
