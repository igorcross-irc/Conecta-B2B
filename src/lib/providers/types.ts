/** Contratos entre o núcleo do sistema e as fontes de dados. */

export interface Socio {
  nome: string;
  qualificacao: string;
  /** Data de entrada na sociedade (AAAA-MM-DD), quando a fonte informa. */
  desde?: string;
  /** Sócio que é empresa (holding, fundo...), segundo a fonte. Não é pessoa para abordar. */
  pessoaJuridica?: boolean;
}

export interface Endereco {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
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
  endereco?: Endereco;
  /** Data de abertura (AAAA-MM-DD). */
  abertaEm?: string;
  /** true = matriz, false = filial. */
  matriz?: boolean;
  cnaesSecundarios?: { codigo: number; descricao: string }[];
  simples?: boolean;
  mei?: boolean;
  telefones: string[];
  /** E-mails cadastrados na Receita. Costumam ser da contabilidade; não são contato de decisor. */
  emailsCadastrais: string[];
  dominio?: string;
  socios: Socio[];
  fonte: string;
  obtidoEm: string;
  /** Versão do formato guardado em cache; fichas antigas (sem versão) são consultadas de novo. */
  versao?: number;
}

export const VERSAO_EMPRESA = 2;

export type StatusEmail = "verificado" | "nao_verificado" | "inferido" | "dominio_ok";

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
