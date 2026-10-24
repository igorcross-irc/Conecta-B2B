import { confirmarOptOutPublico, permitirPedidoPublico, responderErro } from "@/lib/app";
import { ipDoPedido } from "@/lib/ip";

/** POST /api/optout/confirmar  { token }  — confirma o pedido do link enviado por e-mail. */
export async function POST(req: Request) {
  try {
    if (!(await permitirPedidoPublico(`optout-confirmar:${ipDoPedido(req)}`, 20, 3600))) {
      return Response.json({ erro: "Muitos pedidos. Tente novamente mais tarde." }, { status: 429 });
    }
    const { token } = (await req.json()) as { token?: string };
    await confirmarOptOutPublico(token ?? "");
    return Response.json({ ok: true });
  } catch (e) {
    return responderErro(e);
  }
}
