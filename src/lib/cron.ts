import { timingSafeEqual } from "node:crypto";

/** Confere o `Authorization: Bearer CRON_SECRET` que a Vercel manda nas rotas de cron (comparação em tempo constante). */
export function cronAutorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
