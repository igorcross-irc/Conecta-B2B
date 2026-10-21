import { registrarOptOutPublico, responderErro } from "@/lib/app";

/**
 * POST /api/optout  { email }
 * Rota pública (quem pede para sair não tem conta). Falta confirmar o pedido por e-mail e limitar abuso.
 */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    await registrarOptOutPublico(email ?? "");
    return Response.json({ ok: true });
  } catch (e) {
    return responderErro(e);
  }
}
