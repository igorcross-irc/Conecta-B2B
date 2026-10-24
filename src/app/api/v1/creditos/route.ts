import { responderErro, servicosPorChave } from "@/lib/app";

/** GET /api/v1/creditos — saldo da organização. */
export async function GET(req: Request) {
  try {
    const a = await servicosPorChave(req);
    if ("erro" in a) return a.erro;
    const o = await a.servicos.organizacao();
    return Response.json({ saldo: o.saldo });
  } catch (e) {
    return responderErro(e);
  }
}
