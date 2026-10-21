import { responderErro, servicos } from "@/lib/app";

/**
 * POST /api/optout  { email }
 * Rota pública (quem pede para sair não tem conta). Quando houver login, esta rota deve usar
 * uma conexão de sistema, não a sessão de um cliente. Também falta confirmar o pedido por e-mail.
 */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    await (await servicos(req.headers)).registrarOptOut(email ?? "");
    return Response.json({ ok: true });
  } catch (e) {
    return responderErro(e);
  }
}
