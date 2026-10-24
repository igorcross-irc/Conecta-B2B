/** Informações extras de uma empresa, vindas de fontes públicas diferentes. Cada bloco é independente: se uma fonte falha, as outras seguem. */

export interface InfoCvm {
  /** Nome na CVM (companhia aberta). */
  nome: string;
  situacao: string;
  setor?: string;
  mercado?: string;
  categoria?: string;
  controleAcionario?: string;
  constituidaEm?: string;
  auditor?: string;
  site?: string;
  /** Diretor de Relações com Investidores (ou o responsável cadastrado) e os canais publicados. */
  responsavel?: { nome: string; cargo: string; emails: string[]; telefone?: string };
  emails: string[];
  telefone?: string;
}

export interface InfoWikidata {
  id: string;
  url: string;
  nome?: string;
  funcionarios?: { valor: number; ano?: number };
  receita?: { valor: number; moeda: "USD" | "BRL" | "EUR"; ano?: number };
  fundadaEm?: number;
  site?: string;
  linkedin?: string;
}

export interface Noticia {
  titulo: string;
  fonte?: string;
  url: string;
  publicadaEm?: string;
}

export interface Sancao {
  cadastro: "CEIS" | "CNEP";
  tipo?: string;
  orgao?: string;
  inicio?: string;
  fim?: string;
  link?: string;
  multa?: string;
}

export interface Enriquecimento {
  cvm?: InfoCvm | null;
  wikidata?: InfoWikidata | null;
  noticias?: Noticia[];
  /** undefined = fonte não configurada (sem token); [] = consultado e sem sanções. */
  sancoes?: Sancao[];
  /** Fontes que falharam agora (mensagem curta), sem derrubar as outras. */
  erros: Record<string, string>;
  obtidoEm: string;
}

export type FonteEnriquecimento = "cvm" | "wikidata" | "noticias" | "sancoes";
