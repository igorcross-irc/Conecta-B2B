import { responderErro, servicos } from "@/lib/app";

/** GET /api/listas */
export async function GET() {
  const s = servicos();
  return Response.json(
    s.listas().map((l) => ({ ...l, contatos: s.contatosDaLista(l.id) })),
  );
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
    const s = servicos();
    if (corpo.listaId) {
      return Response.json(s.adicionarALista(corpo.listaId, corpo.contatoIds ?? []));
    }
    return Response.json(s.criarLista(corpo.nome ?? ""));
  } catch (e) {
    return responderErro(e);
  }
}
