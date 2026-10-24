/** IP do cliente. Na Vercel os cabeçalhos x-vercel-forwarded-for e x-real-ip são definidos pela plataforma. */
export function ipDoPedido(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    "desconhecido"
  );
}
