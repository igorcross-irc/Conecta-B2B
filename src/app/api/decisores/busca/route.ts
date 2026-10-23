import { after } from "next/server";
import { responderErro, servicos } from "@/lib/app";

// A busca continua rodando depois da resposta, até este limite (em plataformas que o respeitam).
export const maxDuration = 120;

/**
 * POST /api/decisores/busca  { cnpj, cargos: string[], chave: string }
 * Cria a busca, cobra o crédito e responde na hora; o trabalho segue em segundo plano.
 * Acompanhe com GET /api/decisores/busca/{id}.
 */
export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as { cnpj?: string; cargos?: string[]; chave?: string };
    if (!corpo.chave) return Response.json({ erro: "Informe a chave de idempotência." }, { status: 400 });
    const s = await servicos();
    const estado = await s.iniciarBusca({ cnpj: corpo.cnpj ?? "", cargos: corpo.cargos ?? [], chave: corpo.chave });
    if (estado.status === "em_andamento") after(() => s.executarBusca(estado.id));
    return Response.json(estado, { status: 202 });
  } catch (e) {
    return responderErro(e);
  }
}

/** GET /api/decisores/busca?cnpj=...  Última busca desta organização para a empresa (ou null). */
export async function GET(req: Request) {
  try {
    const cnpj = new URL(req.url).searchParams.get("cnpj") ?? "";
    return Response.json(await (await servicos()).ultimaBusca(cnpj));
  } catch (e) {
    return responderErro(e);
  }
}
