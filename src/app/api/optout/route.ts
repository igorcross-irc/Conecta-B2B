import { registrarOptOutPublico, responderErro } from "@/lib/app";
import { criarLimite } from "@/lib/limite";

// 5 pedidos por hora por IP. Falta ainda confirmar o pedido por e-mail (precisa de um serviço de envio).
const limite = criarLimite(5, 60 * 60 * 1000);

/**
 * POST /api/optout  { email }
 * Rota pública (quem pede para sair não tem conta).
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconhecido";
    if (!limite.permitir(ip)) {
      return Response.json({ erro: "Muitos pedidos. Tente novamente mais tarde." }, { status: 429 });
    }
    const { email } = (await req.json()) as { email?: string };
    await registrarOptOutPublico(email ?? "");
    return Response.json({ ok: true });
  } catch (e) {
    return responderErro(e);
  }
}
