import { createHash } from "node:crypto";
import type { Db } from "@/db/conexao";
import type { TabelaCustos } from "./credits";
import type { Registrador } from "./monitor";
import type { Contato, Empresa, ProvedorContatos, ProvedorEmpresa } from "./providers/types";
import type { FiltrosUrl } from "./filtrosUrl";
import { ErroDeNegocio, type ContatoGuardado, type ContatoVisivel } from "./servicos";

export interface PesquisaFiltros {
  nome?: string; termos?: string; uf?: string; cidade?: string; bairro?: string; segmento?: string;
  /** ids de macro-setores (ver setores.ts). */
  setores?: string[];
  porte?: string[];
  /** id de faixa de tempo de abertura (ver ABERTURAS). */
  abertura?: string;
  comEmail?: boolean;
  comTelefone?: boolean;
  ordem?: "nome" | "recentes";
  /** Só empresas abertas a partir desta data (AAAA-MM-DD). */
  abertaDesde?: string;
  incluirFiliais?: boolean; pagina?: number;
  /** Itens por página (padrão 25; a exportação usa até 5.000). */
  porPagina?: number;
  /** Traz também e-mail, telefone e CNAE cadastrais de cada empresa (para exportação). */
  completo?: boolean;
}
export interface ResumoProvedor {
  provedor: string; tipo: string;
  chamadas24h: number; falhas24h: number; chamadas7d: number; falhas7d: number;
  p50?: number; p95?: number; ultimoSucesso?: string; ultimaFalha?: string; ultimoErro?: string; itensMedio?: number;
}
export interface PesquisaSalva {
  id: string; nome: string; filtros: FiltrosUrl; avisar: boolean; ultimoAviso: string; criadoEm: string;
}
export interface ItemPesquisa {
  cnpj: string; razaoSocial: string; nomeFantasia?: string; municipio?: string; uf?: string;
  bairro?: string; atividade?: string; dominio?: string;
  porte?: string; abertaEm?: string; temEmail: boolean; temTelefone: boolean; matriz: boolean;
  /** Só com `completo`: dados cadastrais da Receita. */
  email?: string; telefone?: string; cnae?: number;
}
export interface ResultadoPesquisa { itens: ItemPesquisa[]; total: number; baseReceita: boolean; sites: string[] }

export interface EstadoBusca {
  id: string;
  cnpj: string;
  status: "em_andamento" | "concluida" | "erro";
  etapa: string;
  /** Verdadeiro quando o resultado veio de uma varredura anterior (pool), sem consultar as fontes de novo. */
  doPool: boolean;
  erro?: string;
  contatos?: ContatoVisivel[];
  saldo?: number;
}

/** Validade do resultado no pool: 90 dias quando achou alguém, 1 dia quando não achou nada. */
export const VALIDADE_SQL = "case when jsonb_array_length(contatos) > 0 then interval '90 days' else interval '1 day' end";
/** Uma busca sem sinal de vida por tanto tempo é considerada perdida (servidor reiniciou ou excedeu o prazo). */
export const TEMPO_MAXIMO_BUSCA_MIN = 5;

export interface ListaPg {
  id: string;
  nome: string;
  contatoIds: string[];
}

/** Quem está agindo: define o que pode fazer (administrador da organização, operadora da plataforma). */
export interface Ator {
  usuarioId: string;
  papel: "administrador" | "membro";
  operadora: boolean;
}

export interface Membro {
  usuarioId: string;
  nome?: string;
  email?: string;
  papel: "administrador" | "membro";
}

export interface ConvitePendente {
  id: string;
  email: string;
  papel: "administrador" | "membro";
  criadoEm: string;
  expiraEm: string;
}

export interface ItemBase {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  municipio?: string;
  uf?: string;
  atividade?: string;
  dominio?: string;
  noPool: number;
  daComunidade: number;
  tags: string[];
  atualizadoEm: string;
}

export interface Dependencias {
  db: Db;
  ator?: Ator;
  empresa: ProvedorEmpresa;
  contatos: ProvedorContatos[];
  /** Acha CNPJs publicados num site (para buscar a empresa pelo endereço do site). */
  descobridor?: (dominio: string) => Promise<{ cnpj: string; ocorrencias: number }[]>;
  org?: string;
  /** Grava a execução de cada fonte de dados (monitoramento). */
  registrar?: Registrador;
}

export type Linha = Record<string, unknown>;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Converte erros das funções SQL em erros de negócio com o status certo. */
export function traduzir(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/saldo insuficiente/.test(msg)) throw new ErroDeNegocio("Saldo de créditos insuficiente.", 402);
  if (/dado inexistente/.test(msg))
    throw new ErroDeNegocio("Este contato não tem esse dado. Nada foi cobrado.", 404);
  if (/sem acesso/.test(msg)) throw new ErroDeNegocio("Sem acesso a esta organização.", 403);
  if (/não encontrado/.test(msg)) throw new ErroDeNegocio("Contato não encontrado.", 404);
  if (/convite inválido/.test(msg)) throw new ErroDeNegocio("Convite inválido ou expirado.", 404);
  if (/ao menos um administrador/.test(msg))
    throw new ErroDeNegocio("A organização precisa de ao menos um administrador.", 409);
  throw e;
}

export function paraGuardado(r: Linha): ContatoGuardado {
  const contato: Contato = {
    nome: r.nome as string,
    cargo: r.cargo as string,
    senioridade: (r.senioridade as string) ?? undefined,
    departamento: (r.departamento as string) ?? undefined,
    linkedinUrl: (r.linkedin_url as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    emailStatus: (r.email_status as Contato["emailStatus"]) ?? undefined,
    telefone: (r.telefone as string) ?? undefined,
    origem: r.origem as string,
    obtidoEm: new Date(r.obtido_em as string).toISOString(),
    confianca: Number(r.confianca),
  };
  return {
    id: r.id as string,
    cnpj: r.cnpj as string,
    contato,
    emailRevelado: r.email_revelado as boolean,
    telefoneRevelado: r.telefone_revelado as boolean,
  };
}

export const SELECT_CONTATO = `
  select c.*, d.email, d.telefone
    from contato c left join contato_dado d on d.contato_id = c.id`;

/** Mesma interface do serviço em memória, mas persistida em Postgres (todas as chamadas são assíncronas). */
/** Métodos que um grupo de serviços chama em outro (com tipos explícitos, para os grupos não dependerem uns dos tipos dos outros). */
export interface Cruzados {
  cobertura(): Promise<{ uf: string; empresas: number }[]>;
  consultarEmpresa(cnpj: string): Promise<Empresa>;
  custos(): Promise<TabelaCustos>;
  disponiveisNoPool(cnpj: string): Promise<number>;
  listas(): Promise<ListaPg[]>;
  pesquisar(f?: PesquisaFiltros): Promise<ResultadoPesquisa>;
  registrarOptOut(email: string): Promise<{ contatosAfetados: number }>;
  resolverSite(entrada: string): Promise<{
    dominio: string;
    origem: "base" | "site";
    candidatos: { cnpj: string; razaoSocial: string; nomeFantasia?: string; municipio?: string; uf?: string; situacao?: string }[];
  }>;
  statusBusca(jobId: string): Promise<EstadoBusca>;
}

