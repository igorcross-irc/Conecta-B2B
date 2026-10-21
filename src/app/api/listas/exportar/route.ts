import { responderErro, servicos } from "@/lib/app";

/** GET /api/listas/exportar?listaId=lista_1 -> CSV só com o que já foi revelado */
export async function GET(req: Request) {
  try {
    const listaId = new URL(req.url).searchParams.get("listaId") ?? "";
    const csv = await (await servicos()).exportarCsv(listaId);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${listaId}.csv"`,
      },
    });
  } catch (e) {
    return responderErro(e);
  }
}
