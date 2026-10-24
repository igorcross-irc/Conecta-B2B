import { contexto, responderErro } from "@/lib/app";

// A busca por site faz o servidor visitar o endereço informado: limita por usuário (30 por hora, contado no banco).

/**
 * GET /api/empresa?cnpj=33000167000101
 * GET /api/empresa?site=empresa.com.br  -> { dominio, origem, candidatos[] } para a pessoa confirmar
 * GET /api/empresa?cnpj=...&site=...    -> consulta o CNPJ e associa o site a ele na base comum
 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const cnpj = q.get("cnpj") ?? "";
    const site = q.get("site") ?? "";
    const { sessao, servicos } = await contexto();
    if (!cnpj && site) {
      if (!(await servicos.permitirPedido(`site:${sessao.usuarioId}`, 30, 3600))) {
        return Response.json({ erro: "Muitas buscas por site. Tente novamente mais tarde." }, { status: 429 });
      }
      return Response.json(await servicos.resolverSite(site));
    }
    let empresa = await servicos.consultarEmpresa(cnpj);
    if (site) {
      await servicos.associarSite(cnpj, site);
      empresa = await servicos.consultarEmpresa(cnpj);
    }
    return Response.json(empresa);
  } catch (e) {
    return responderErro(e);
  }
}
