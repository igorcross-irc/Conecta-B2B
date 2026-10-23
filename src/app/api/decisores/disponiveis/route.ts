import { responderErro, servicos } from "@/lib/app";

/** GET /api/decisores/disponiveis?cnpj=...  Quantos contatos já estão coletados (grátis). */
export async function GET(req: Request) {
  try {
    const cnpj = new URL(req.url).searchParams.get("cnpj") ?? "";
    return Response.json({ disponiveis: await (await servicos()).disponiveisNoPool(cnpj) });
  } catch (e) {
    return responderErro(e);
  }
}
