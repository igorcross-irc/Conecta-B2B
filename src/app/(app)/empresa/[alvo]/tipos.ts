import type { TomOrigem } from "@/lib/origem";

export interface Empresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  porte?: string;
  naturezaJuridica?: string;
  capitalSocial?: number;
  municipio?: string;
  uf?: string;
  endereco?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cep?: string };
  abertaEm?: string;
  matriz?: boolean;
  simples?: boolean;
  mei?: boolean;
  cnaePrincipal?: { codigo?: number; descricao: string };
  cnaesSecundarios?: { codigo: number; descricao: string }[];
  telefones: string[];
  emailsCadastrais: string[];
  socios: { nome: string; qualificacao: string; desde?: string; pessoaJuridica?: boolean }[];
  dominio?: string;
  fonte: string;
  obtidoEm: string;
}

export const dinheiro = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const dataBr = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : undefined);
export function idade(d?: string): string | undefined {
  if (!d) return undefined;
  const anos = (Date.now() - new Date(d).getTime()) / (365.25 * 864e5);
  return anos < 1 ? "menos de 1 ano" : `${Math.floor(anos)} ano${Math.floor(anos) > 1 ? "s" : ""}`;
}
export const cepBr = (c?: string) => (c && c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);

export interface Contato {
  id: string;
  nome: string;
  cargo: string;
  departamento?: string;
  senioridade?: string;
  temEmail: boolean;
  email?: string;
  emailMascarado?: string;
  emailStatus?: string;
  temTelefone: boolean;
  telefone?: string;
  telefoneMascarado?: string;
  linkedinUrl?: string;
  origem: string;
  obtidoEm: string;
  confianca: number;
}

export const ROTULO_STATUS: Record<string, string> = {
  verificado: "confirmado",
  nao_verificado: "não verificado",
  inferido: "adivinhado pelo padrão da empresa; pode não existir",
  dominio_ok: "o domínio recebe e-mail, mas a caixa não foi confirmada",
};

export const STATUS_CURTO: Record<string, string> = { verificado: "confirmado", nao_verificado: "não verificado", inferido: "palpite, pode não existir", dominio_ok: "domínio recebe e-mail" };

export const COR_ORIGEM: Record<TomOrigem, string> = {
  oficial: "bg-emerald-50 text-emerald-800",
  site: "bg-sky-50 text-sky-800",
  web: "bg-violet-50 text-violet-800",
  terceiro: "bg-slate-100 text-slate-700",
  palpite: "bg-amber-100 text-amber-900",
  comunidade: "bg-slate-100 text-slate-700",
  demonstracao: "bg-amber-100 text-amber-900",
};

export async function chamar<T>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: corpo ? "POST" : "GET",
    headers: corpo ? { "Content-Type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro ?? "Erro inesperado.");
  return dados as T;
}

export interface Sinal {
  id: string;
  tipo: string;
  fonte: string;
  ocorridoEm: string;
}

export interface Busca {
  id: string;
  status: "em_andamento" | "concluida" | "erro";
  etapa: string;
  doPool: boolean;
  erro?: string;
  contatos?: Contato[];
  saldo?: number;
}

export interface Candidato {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  municipio?: string;
  uf?: string;
  situacao?: string;
}

/** "1 crédito", "5 créditos". */
export const creditos = (n: number) => `${n} crédito${n === 1 ? "" : "s"}`;
