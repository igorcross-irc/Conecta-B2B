import { responderErro, servicosPorChave } from "@/lib/app";

/** GET /api/v1/empresa?cnpj=33000167000101 — ficha da empresa (sem custo). */
export async function GET(req: Request) {
  try {
    const a = await servicosPorChave(req);
    if ("erro" in a) return a.erro;
    return Response.json(await a.servicos.consultarEmpresa(new URL(req.url).searchParams.get("cnpj") ?? ""));
  } catch (e) {
    return responderErro(e);
  }
}
