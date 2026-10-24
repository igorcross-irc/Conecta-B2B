import { filtrosDaUrl } from "@/lib/consulta";
import { contexto, responderErro } from "@/lib/app";
import { formatoValido, montarCsvEmpresas } from "@/lib/exportacao";

export const maxDuration = 60;

const LIMITE = 5000;

/**
 * GET /api/pesquisar/exportar?<mesmos filtros da tela>&formato=padrao|hubspot|rdstation|pipedrive[&pagina=0]
 * CSV das EMPRESAS da pesquisa (dados públicos da Receita), até 5.000 por arquivo; `pagina` pega o bloco seguinte. 10 por hora por usuário.
 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const { sessao, servicos } = await contexto();
    if (!(await servicos.permitirPedido(`exportar-empresas:${sessao.usuarioId}`, 10, 3600))) {
      return Response.json({ erro: "Muitas exportações. Tente novamente mais tarde." }, { status: 429 });
    }
    const formato = formatoValido(q.get("formato"));
    const f = filtrosDaUrl(q);
    const r = await servicos.pesquisar({ ...f, porPagina: LIMITE, completo: true });
    if (r.itens.length === 0) return Response.json({ erro: "Nenhuma empresa para exportar com esses filtros." }, { status: 404 });
    const csv = montarCsvEmpresas(
      formato,
      r.itens.map((i) => ({
        cnpj: i.cnpj, razaoSocial: i.razaoSocial, nomeFantasia: i.nomeFantasia, uf: i.uf, municipio: i.municipio, bairro: i.bairro,
        atividade: i.atividade, cnae: i.cnae, porte: i.porte, abertaEm: i.abertaEm, email: i.email, telefone: i.telefone, site: i.dominio,
      })),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="empresas-${formato}.csv"`,
        "X-Total-Empresas": String(r.total),
        "X-Total-Aproximado": r.totalAproximado ? "1" : "0",
      },
    });
  } catch (e) {
    return responderErro(e);
  }
}
