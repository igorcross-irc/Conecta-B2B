import { somenteDigitos } from "../cnpj";
import type { Sancao } from "./tipos";

/**
 * Sanções administrativas do Governo Federal (Portal da Transparência: CEIS e CNEP). A API é gratuita mas exige
 * uma chave pessoal (PORTAL_TRANSPARENCIA_TOKEN; cadastro em portaldatransparencia.gov.br/api-de-dados/cadastrar-email).
 * Os campos seguem o esquema OpenAPI publicado pela CGU; sem a chave, a fonte fica desligada.
 */
const BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";

interface Dto {
  tipoSancao?: { descricaoResumida?: string; descricaoPortal?: string };
  orgaoSancionador?: { nome?: string };
  dataInicioSancao?: string;
  dataFimSancao?: string;
  linkPublicacao?: string;
  valorMulta?: string;
}

export const sancoesConfiguradas = () => Boolean(process.env.PORTAL_TRANSPARENCIA_TOKEN);

export function mapearSancao(cadastro: "CEIS" | "CNEP", d: Dto): Sancao {
  return {
    cadastro,
    tipo: d.tipoSancao?.descricaoResumida || d.tipoSancao?.descricaoPortal,
    orgao: d.orgaoSancionador?.nome,
    inicio: d.dataInicioSancao || undefined,
    fim: d.dataFimSancao || undefined,
    link: d.linkPublicacao && /^https?:\/\//.test(d.linkPublicacao) ? d.linkPublicacao : undefined,
    multa: d.valorMulta || undefined,
  };
}

export async function buscarSancoes(cnpj: string, http: typeof fetch = fetch, token = process.env.PORTAL_TRANSPARENCIA_TOKEN): Promise<Sancao[]> {
  if (!token) throw new Error("PORTAL_TRANSPARENCIA_TOKEN não configurado.");
  const codigo = somenteDigitos(cnpj);
  const saida: Sancao[] = [];
  for (const cadastro of ["CEIS", "CNEP"] as const) {
    const r = await http(`${BASE}/${cadastro.toLowerCase()}?codigoSancionado=${codigo}&pagina=1`, {
      headers: { "chave-api-dados": token, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (r.status === 401 || r.status === 403) throw new Error("Portal da Transparência recusou a chave.");
    if (r.status === 429) throw new Error("Portal da Transparência: limite de pedidos atingido.");
    if (!r.ok) throw new Error(`Portal da Transparência: HTTP ${r.status}`);
    const lista = (await r.json()) as Dto[];
    if (Array.isArray(lista)) saida.push(...lista.slice(0, 10).map((d) => mapearSancao(cadastro, d)));
  }
  return saida;
}
