import { responderErro, servicos } from "@/lib/app";

/** GET /api/listas */
export async function GET() {
  try {
    const s = await servicos();
    const listas = await s.listas();
    return Response.json(
      await Promise.all(
        listas.map(async (l) => ({ ...l, contatos: await s.contatosDaLista(l.id) })),
      ),
    );
  } catch (e) {
    return responderErro(e);
  }
}

/**
 * POST /api/listas  { nome }                          cria lista
 * POST /api/listas  { listaId, contatoIds: string[] } adiciona contatos
 */
export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as {
      nome?: string;
      listaId?: string;
      contatoIds?: string[];
    };
    const s = await servicos();
    if (corpo.listaId) {
      return Response.json(await s.adicionarALista(corpo.listaId, corpo.contatoIds ?? []));
    }
    return Response.json(await s.criarLista(corpo.nome ?? ""));
  } catch (e) {
    return responderErro(e);
  }
}
