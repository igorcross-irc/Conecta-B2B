import { contexto, responderErro } from "@/lib/app";

/** GET /api/empresa/pessoas?cnpj=...  Pessoas já colhidas pela organização para a empresa (de qualquer busca), sem custo. */
export async function GET(req: Request) {
  try {
    const cnpj = new URL(req.url).searchParams.get("cnpj") ?? "";
    const { servicos } = await contexto();
    return Response.json(await servicos.contatosDaEmpresa(cnpj));
  } catch (e) {
    return responderErro(e);
  }
}
