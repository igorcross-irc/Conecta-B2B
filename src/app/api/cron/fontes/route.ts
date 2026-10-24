import { timingSafeEqual } from "node:crypto";
import { avisarFontesPublico } from "@/lib/app";
import { emailConfigurado } from "@/lib/email";

function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** GET /api/cron/fontes — avisa a operadora por e-mail se alguma fonte de dados estiver fora do ar (cron da Vercel). */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (!autorizado(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const para = process.env.OPERADORA_EMAIL;
  if (!para || !emailConfigurado()) return Response.json({ erro: "OPERADORA_EMAIL ou envio de e-mail não configurado." }, { status: 503 });
  try {
    return Response.json(await avisarFontesPublico(para));
  } catch (e) {
    console.error("cron fontes", e instanceof Error ? e.message : e);
    return Response.json({ erro: "Falha ao verificar as fontes." }, { status: 500 });
  }
}
