import { cnpjValido, somenteDigitos } from "../cnpj";
import { VERSAO_EMPRESA, type Empresa, type ProvedorEmpresa } from "./types";

/**
 * BrasilAPI (gratuita, sem cadastro): GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 * Traz os sócios e administradores (QSA) com o nome completo, que a API aberta da CNPJá mascara.
 * Formato conforme a documentação pública da BrasilAPI; ainda NÃO conferido com uma resposta real
 * (o ambiente de desenvolvimento não alcança a API). Confirmar na primeira execução.
 */
const URL_BASE = "https://brasilapi.com.br/api/cnpj/v1";

export interface RespostaBrasilApi {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  descricao_situacao_cadastral?: string;
  porte?: string;
  natureza_juridica?: string;
  capital_social?: number;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: { codigo?: number; descricao?: string }[];
  logradouro?: string | null;
  descricao_tipo_de_logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | number | null;
  data_inicio_atividade?: string | null;
  identificador_matriz_filial?: number;
  opcao_pelo_simples?: boolean | null;
  opcao_pelo_mei?: boolean | null;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  email?: string | null;
  qsa?: { nome_socio?: string; qualificacao_socio?: string; data_entrada_sociedade?: string | null }[];
}

function telefone(v?: string | null): string[] {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length < 10) return [];
  return [`(${d.slice(0, 2)}) ${d.slice(2)}`];
}

/** Provedores de e-mail abertos ou de contabilidade comum: não indicam o domínio da empresa. */
const DOMINIOS_GENERICOS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br", "uol.com.br",
  "bol.com.br", "terra.com.br", "ig.com.br", "globo.com", "live.com", "icloud.com",
]);

export function dominioDoEmail(email?: string | null): string | undefined {
  const d = email?.split("@")[1]?.trim().toLowerCase();
  return d && !DOMINIOS_GENERICOS.has(d) ? d : undefined;
}

export function mapearBrasilApi(r: RespostaBrasilApi, agora = new Date()): Empresa {
  return {
    cnpj: somenteDigitos(r.cnpj),
    razaoSocial: r.razao_social ?? "",
    nomeFantasia: r.nome_fantasia || undefined,
    situacao: r.descricao_situacao_cadastral ?? "Desconhecida",
    porte: r.porte,
    naturezaJuridica: r.natureza_juridica,
    capitalSocial: r.capital_social,
    cnaePrincipal: r.cnae_fiscal
      ? { codigo: r.cnae_fiscal, descricao: r.cnae_fiscal_descricao ?? "" }
      : undefined,
    municipio: r.municipio,
    uf: r.uf,
    endereco: {
      logradouro: [r.descricao_tipo_de_logradouro, r.logradouro].filter(Boolean).join(" ") || undefined,
      numero: r.numero || undefined,
      complemento: r.complemento || undefined,
      bairro: r.bairro || undefined,
      cep: r.cep ? String(r.cep).padStart(8, "0") : undefined,
    },
    abertaEm: r.data_inicio_atividade || undefined,
    matriz: r.identificador_matriz_filial === undefined ? undefined : r.identificador_matriz_filial === 1,
    cnaesSecundarios: (r.cnaes_secundarios ?? [])
      .filter((c) => c.codigo)
      .map((c) => ({ codigo: c.codigo!, descricao: c.descricao ?? "" })),
    simples: r.opcao_pelo_simples ?? undefined,
    mei: r.opcao_pelo_mei ?? undefined,
    telefones: [...telefone(r.ddd_telefone_1), ...telefone(r.ddd_telefone_2)],
    emailsCadastrais: r.email ? [r.email.toLowerCase()] : [],
    // O e-mail cadastral costuma ser da contabilidade; o domínio é só uma pista, confirmada no site.
    dominio: dominioDoEmail(r.email),
    socios: (r.qsa ?? [])
      .filter((s) => s.nome_socio)
      .map((s) => ({ nome: s.nome_socio!, qualificacao: s.qualificacao_socio ?? "", desde: s.data_entrada_sociedade || undefined })),
    fonte: "BrasilAPI (Receita Federal)",
    obtidoEm: agora.toISOString(),
    versao: VERSAO_EMPRESA,
  };
}

export class BrasilApi implements ProvedorEmpresa {
  nome = "BrasilAPI (Receita Federal)";

  constructor(private http: typeof fetch = fetch) {}

  async buscarPorCnpj(cnpj: string): Promise<Empresa | null> {
    if (!cnpjValido(cnpj)) throw new Error("CNPJ inválido.");
    const res = await this.http(`${URL_BASE}/${somenteDigitos(cnpj)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (res.status === 429) throw new Error("Limite de consultas da BrasilAPI atingido. Tente em instantes.");
    if (!res.ok) throw new Error(`Falha na BrasilAPI (HTTP ${res.status}).`);
    return mapearBrasilApi((await res.json()) as RespostaBrasilApi);
  }
}

/**
 * Tenta as fontes na ordem e junta o que cada uma traz de útil: a primeira que responder
 * define a empresa; as demais só completam sócios (nomes completos) e domínio quando faltam.
 */
export class EmpresaEmCascata implements ProvedorEmpresa {
  nome: string;
  constructor(private fontes: ProvedorEmpresa[]) {
    this.nome = fontes.map((f) => f.nome).join(" + ");
  }

  async buscarPorCnpj(cnpj: string): Promise<Empresa | null> {
    let base: Empresa | null = null;
    let ultimoErro: unknown;
    for (const f of this.fontes) {
      try {
        const e = await f.buscarPorCnpj(cnpj);
        if (!e) continue;
        if (!base) base = e;
        else {
          const mascarados = (n: string) => n.includes("[MASKED]");
          if (!base.socios.length || base.socios.every((s) => mascarados(s.nome))) base.socios = e.socios;
          base.dominio ??= e.dominio;
          if (!base.telefones.length) base.telefones = e.telefones;
        }
        if (base.socios.length && !base.socios.every((s) => s.nome.includes("[MASKED]"))) break;
      } catch (err) {
        ultimoErro = err;
      }
    }
    if (!base && ultimoErro) throw ultimoErro;
    return base;
  }
}
