import { responderErro, servicos } from "@/lib/app";

/** POST /api/decisores  { cnpj, cargos: string[], chave: string } */
export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as {
      cnpj?: string;
      cargos?: string[];
      chave?: string;
    };
    if (!corpo.chave) {
      return Response.json({ erro: "Informe a chave de idempotência." }, { status: 400 });
    }
    return Response.json(
      await (await servicos()).buscarDecisores({
        cnpj: corpo.cnpj ?? "",
        cargos: corpo.cargos ?? [],
        chave: corpo.chave,
      }),
    );
  } catch (e) {
    return responderErro(e);
  }
}
