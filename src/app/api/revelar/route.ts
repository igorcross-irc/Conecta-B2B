import { responderErro, servicos } from "@/lib/app";

/** POST /api/revelar  { contatoId, campo: "email" | "telefone" } */
export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as { contatoId?: string; campo?: string };
    if (corpo.campo !== "email" && corpo.campo !== "telefone") {
      return Response.json({ erro: "Campo deve ser email ou telefone." }, { status: 400 });
    }
    return Response.json(
      servicos().revelar({ contatoId: corpo.contatoId ?? "", campo: corpo.campo }),
    );
  } catch (e) {
    return responderErro(e);
  }
}
