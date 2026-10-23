import { responderErro, servicos } from "@/lib/app";

/** GET /api/decisores/busca/{id}  Andamento e, ao concluir, os contatos. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return Response.json(await (await servicos()).statusBusca(id));
  } catch (e) {
    return responderErro(e);
  }
}
