import { timingSafeEqual } from "node:crypto";
import { rodarAlertasPublico } from "@/lib/app";
import { emailConfigurado } from "@/lib/email";

export const maxDuration = 120;

function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** GET /api/cron/alertas — chamado pelo cron da Vercel (com Authorization: Bearer CRON_SECRET). */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (!autorizado(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  if (!emailConfigurado()) return Response.json({ erro: "Envio de e-mail não configurado." }, { status: 503 });
  try {
    return Response.json(await rodarAlertasPublico());
  } catch (e) {
    console.error("cron alertas", e instanceof Error ? e.message : e);
    return Response.json({ erro: "Falha ao rodar os avisos." }, { status: 500 });
  }
}
