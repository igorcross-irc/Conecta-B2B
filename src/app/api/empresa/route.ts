import { responderErro, servicos } from "@/lib/app";

/** GET /api/empresa?cnpj=33000167000101 */
export async function GET(req: Request) {
  try {
    const cnpj = new URL(req.url).searchParams.get("cnpj") ?? "";
    return Response.json(await (await servicos()).consultarEmpresa(cnpj));
  } catch (e) {
    return responderErro(e);
  }
}
