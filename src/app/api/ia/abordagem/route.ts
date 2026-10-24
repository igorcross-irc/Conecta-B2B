import { contexto, registrarFonte, responderErro } from "@/lib/app";
import { medir } from "@/lib/monitor";
import { redigirAbordagem } from "@/lib/ia/assistente";
import { chaveGemini } from "@/lib/ia/gemini";
import { ErroDeNegocio } from "@/lib/servicos";

/** POST /api/ia/abordagem  { contatoId, canal, proposta, remetente? } -> { mensagem }. Não usa e-mail nem telefone do contato. */
export async function POST(req: Request) {
  try {
    const { sessao, servicos } = await contexto();
    if (!(await servicos.permitirPedido(`ia:${sessao.usuarioId}`, 30, 3600))) {
      return Response.json({ erro: "Muitos pedidos à IA. Tente novamente mais tarde." }, { status: 429 });
    }
    const c = (await req.json()) as { contatoId?: string; canal?: string; proposta?: string; remetente?: string };
    if (c.canal !== "email" && c.canal !== "whatsapp" && c.canal !== "linkedin") {
      return Response.json({ erro: "Canal deve ser email, whatsapp ou linkedin." }, { status: 400 });
    }
    const canal = c.canal;
    const dados = await servicos.dadosParaAbordagem(c.contatoId ?? "");
    try {
      const mensagem = await medir("Gemini: mensagem de abordagem", "ia", () => redigirAbordagem({
        ...dados, canal, proposta: c.proposta ?? "", remetente: (c.remetente ?? sessao.nome ?? "").slice(0, 80),
      }), registrarFonte, () => 1);
      return Response.json({ mensagem });
    } catch (e) {
      throw new ErroDeNegocio(e instanceof Error ? e.message : "A IA não respondeu.", chaveGemini() ? 502 : 503);
    }
  } catch (e) {
    return responderErro(e);
  }
}
