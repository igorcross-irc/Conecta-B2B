import { contexto, responderErro } from "@/lib/app";

/** GET /api/pesquisar/sugestoes?campo=cidade&q=nit&uf=RJ  |  ?campo=segmento&q=padaria  — sugestões ao digitar. */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const campo = q.get("campo");
    if (campo !== "cidade" && campo !== "segmento") return Response.json({ erro: "Campo inválido." }, { status: 400 });
    const { servicos } = await contexto();
    return Response.json(await servicos.sugerir(campo, q.get("q") ?? "", q.get("uf") ?? undefined));
  } catch (e) {
    return responderErro(e);
  }
}
