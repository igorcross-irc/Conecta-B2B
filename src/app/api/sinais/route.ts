import { responderErro, servicos } from "@/lib/app";

/** GET /api/sinais?cnpj=... -> sinais de compra da empresa */
export async function GET(req: Request) {
  try {
    const cnpj = new URL(req.url).searchParams.get("cnpj") ?? "";
    return Response.json(await (await servicos()).sinaisDoCnpj(cnpj));
  } catch (e) {
    return responderErro(e);
  }
}

/** POST /api/sinais  { cnpj, tipo, fonte, ocorridoEm, conteudo? } */
export async function POST(req: Request) {
  try {
    const c = (await req.json()) as {
      cnpj?: string;
      tipo?: string;
      fonte?: string;
      ocorridoEm?: string;
      conteudo?: unknown;
    };
    return Response.json(
      await (await servicos()).registrarSinal({
        cnpj: c.cnpj ?? "",
        tipo: c.tipo ?? "",
        fonte: c.fonte ?? "",
        ocorridoEm: c.ocorridoEm ?? "",
        conteudo: c.conteudo,
      }),
    );
  } catch (e) {
    return responderErro(e);
  }
}
