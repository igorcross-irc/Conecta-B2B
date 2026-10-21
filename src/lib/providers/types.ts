/** Contratos entre o núcleo do sistema e as fontes de dados. */

export interface Socio {
  nome: string;
  qualificacao: string;
}

export interface Empresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  porte?: string;
  naturezaJuridica?: string;
  capitalSocial?: number;
  cnaePrincipal?: { codigo: number; descricao: string };
  municipio?: string;
  uf?: string;
  telefones: string[];
  /** E-mails cadastrados na Receita. Costumam ser da contabilidade; não são contato de decisor. */
  emailsCadastrais: string[];
  dominio?: string;
  socios: Socio[];
  fonte: string;
  obtidoEm: string;
}

export type StatusEmail = "verificado" | "nao_verificado" | "inferido";

export interface Contato {
  nome: string;
  cargo: string;
  senioridade?: string;
  departamento?: string;
  email?: string;
  emailStatus?: StatusEmail;
  telefone?: string;
  linkedinUrl?: string;
  /** De onde veio o dado (provedor ou página). Obrigatório: base da LGPD e da auditoria. */
  origem: string;
  obtidoEm: string;
  /** De 0 a 1. */
  confianca: number;
}

export interface EntradaBuscaContatos {
  empresa: Empresa;
  /** Termos de cargo desejados, em minúsculas (ex.: "marketing", "comercial"). */
  cargos: string[];
}

export interface ProvedorContatos {
  nome: string;
  buscar(entrada: EntradaBuscaContatos): Promise<Contato[]>;
}

export interface ProvedorEmpresa {
  nome: string;
  buscarPorCnpj(cnpj: string): Promise<Empresa | null>;
}
