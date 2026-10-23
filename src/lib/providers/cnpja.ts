import { cnpjValido, somenteDigitos } from "../cnpj";
import { VERSAO_EMPRESA, type Empresa, type ProvedorEmpresa } from "./types";

/**
 * API aberta da CNPJá: GET https://open.cnpja.com/office/{cnpj}
 * Sem cadastro, 5 consultas por minuto por IP (conforme a documentação da CNPJá).
 * O formato abaixo foi lido de uma resposta real em 21/10/2026.
 */
const URL_BASE = "https://open.cnpja.com/office";

interface RespostaCnpja {
  updated?: string;
  taxId: string;
  alias?: string | null;
  status?: { text?: string };
  founded?: string;
  head?: boolean;
  company?: {
    name?: string;
    equity?: number;
    nature?: { text?: string };
    size?: { text?: string };
    simples?: { optant?: boolean };
    simei?: { optant?: boolean };
    members?: { since?: string; person?: { name?: string }; role?: { text?: string } }[];
  };
  address?: { street?: string; number?: string; details?: string; district?: string; city?: string; state?: string; zip?: string };
  sideActivities?: { id: number; text: string }[];
  phones?: { area?: string; number?: string }[];
  emails?: { address?: string; domain?: string; ownership?: string }[];
  mainActivity?: { id: number; text: string };
}

/** Converte a resposta da CNPJá para o modelo interno. Exportada para teste. */
export function mapearCnpja(r: RespostaCnpja, agora = new Date()): Empresa {
  const emails = r.emails ?? [];
  const dominio = emails.find((e) => e.ownership === "CORPORATE")?.domain;
  return {
    cnpj: r.taxId,
    razaoSocial: r.company?.name ?? "",
    nomeFantasia: r.alias ?? undefined,
    situacao: r.status?.text ?? "Desconhecida",
    porte: r.company?.size?.text,
    naturezaJuridica: r.company?.nature?.text,
    capitalSocial: r.company?.equity,
    cnaePrincipal: r.mainActivity
      ? { codigo: r.mainActivity.id, descricao: r.mainActivity.text }
      : undefined,
    municipio: r.address?.city,
    uf: r.address?.state,
    endereco: {
      logradouro: r.address?.street || undefined,
      numero: r.address?.number || undefined,
      complemento: r.address?.details || undefined,
      bairro: r.address?.district || undefined,
      cep: r.address?.zip || undefined,
    },
    abertaEm: r.founded || undefined,
    matriz: r.head,
    cnaesSecundarios: (r.sideActivities ?? []).map((c) => ({ codigo: c.id, descricao: c.text })),
    simples: r.company?.simples?.optant,
    mei: r.company?.simei?.optant,
    telefones: (r.phones ?? [])
      .filter((t) => t.number)
      .map((t) => `(${t.area ?? ""}) ${t.number}`),
    emailsCadastrais: emails.flatMap((e) => (e.address ? [e.address] : [])),
    dominio,
    socios: (r.company?.members ?? []).map((m) => ({
      nome: m.person?.name ?? "",
      qualificacao: m.role?.text ?? "",
      desde: m.since,
    })),
    fonte: "CNPJá (API aberta)",
    obtidoEm: agora.toISOString(),
    versao: VERSAO_EMPRESA,
  };
}

export class CnpjaAberta implements ProvedorEmpresa {
  nome = "CNPJá (API aberta)";

  constructor(private http: typeof fetch = fetch) {}

  async buscarPorCnpj(cnpj: string): Promise<Empresa | null> {
    if (!cnpjValido(cnpj)) throw new Error("CNPJ inválido.");
    const res = await this.http(`${URL_BASE}/${somenteDigitos(cnpj)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (res.status === 429) {
      throw new Error(
        "Limite de consultas da API aberta atingido (5 por minuto). Tente em instantes.",
      );
    }
    if (!res.ok) throw new Error(`Falha na consulta de CNPJ (HTTP ${res.status}).`);
    return mapearCnpja((await res.json()) as RespostaCnpja);
  }
}
