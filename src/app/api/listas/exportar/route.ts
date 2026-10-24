import { responderErro, servicos } from "@/lib/app";
import { formatoValido } from "@/lib/exportacao";

/** GET /api/listas/exportar?listaId=...&formato=padrao|hubspot|rdstation|pipedrive -> CSV só com o que já foi revelado */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const listaId = q.get("listaId") ?? "";
    const formato = formatoValido(q.get("formato"));
    const csv = await (await servicos()).exportarCsv(listaId, formato);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lista-${formato}.csv"`,
      },
    });
  } catch (e) {
    return responderErro(e);
  }
}
