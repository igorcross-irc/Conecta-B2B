import { pedirOptOutPublico, permitirPedidoPublico, responderErro } from "@/lib/app";
import { ipDoPedido } from "@/lib/ip";
import { ErroDeNegocio } from "@/lib/erros";

/**
 * POST /api/optout  { email }
 * Rota pública (quem pede para sair não tem conta). Limite de 5 pedidos por hora por IP, contado no banco.
 * Com e-mail configurado, o apagamento só acontece depois que o dono do e-mail confirma pelo link.
 */
export async function POST(req: Request) {
  try {
    if (!(await permitirPedidoPublico(`optout:${ipDoPedido(req)}`, 5, 3600))) {
      return Response.json({ erro: "Muitos pedidos. Tente novamente mais tarde." }, { status: 429 });
    }
    const { email } = (await req.json()) as { email?: string };
    try {
      const r = await pedirOptOutPublico(email ?? "");
      return Response.json({ ok: true, confirmacaoPorEmail: r.confirmacaoPorEmail });
    } catch (e) {
      if (e instanceof ErroDeNegocio) throw e;
      // Falha no envio do e-mail: não revela nada ao visitante, mas deixa registrado.
      console.error("optout: falha ao enviar a confirmação", e instanceof Error ? e.message : e);
      return Response.json({ ok: true, confirmacaoPorEmail: true });
    }
  } catch (e) {
    return responderErro(e);
  }
}
