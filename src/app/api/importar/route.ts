import { responderErro, servicos } from "@/lib/app";

const LIMITE_BYTES = 1_000_000;

/** POST /api/importar[?compartilhar=1]  (corpo: texto CSV; compartilhar=1 também envia os contatos à base comum) -> { importados, ignorados, erros } */
export async function POST(req: Request) {
  try {
    const texto = await req.text();
    const compartilhar = new URL(req.url).searchParams.get("compartilhar") === "1";
    if (texto.length > LIMITE_BYTES) {
      return Response.json({ erro: "Arquivo acima de 1 MB." }, { status: 413 });
    }
    return Response.json(await (await servicos()).importarContatos(texto, { compartilhar }));
  } catch (e) {
    return responderErro(e);
  }
}
