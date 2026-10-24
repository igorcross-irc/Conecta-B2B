import { cronAutorizado } from "@/lib/cron";
import { rodarAlertasPublico } from "@/lib/app";
import { emailConfigurado } from "@/lib/email";

export const maxDuration = 120;

/** GET /api/cron/alertas — chamado pelo cron da Vercel (com Authorization: Bearer CRON_SECRET). */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (!cronAutorizado(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  if (!emailConfigurado()) return Response.json({ erro: "Envio de e-mail não configurado." }, { status: 503 });
  try {
    return Response.json(await rodarAlertasPublico());
  } catch (e) {
    console.error("cron alertas", e instanceof Error ? e.message : e);
    return Response.json({ erro: "Falha ao rodar os avisos." }, { status: 500 });
  }
}
