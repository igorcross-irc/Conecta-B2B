import { responderErro, servicos } from "@/lib/app";

const LIMITE_BYTES = 1_000_000;

/** POST /api/importar  (corpo: texto CSV) -> { importados, ignorados, erros } */
export async function POST(req: Request) {
  try {
    const texto = await req.text();
    if (texto.length > LIMITE_BYTES) {
      return Response.json({ erro: "Arquivo acima de 1 MB." }, { status: 413 });
    }
    return Response.json(await (await servicos()).importarContatos(texto));
  } catch (e) {
    return responderErro(e);
  }
}
