import { celulaCsv } from "./contatos";

/** Uma pessoa já revelada (o que não foi revelado nunca chega aqui), com a empresa. */
export interface LinhaExportacao {
  nome: string;
  cargo: string;
  email?: string;
  telefone?: string;
  linkedin?: string;
  origem: string;
  empresa?: string;
  site?: string;
  /** CNPJ (14 dígitos), para o CRM não duplicar a empresa. */
  cnpj?: string;
}

export const FORMATOS = ["padrao", "hubspot", "rdstation", "pipedrive"] as const;
export type FormatoExportacao = (typeof FORMATOS)[number];

export const ROTULO_FORMATO: Record<FormatoExportacao, string> = {
  padrao: "CSV padrão",
  hubspot: "HubSpot",
  rdstation: "RD Station",
  pipedrive: "Pipedrive",
};

const separarNome = (nome: string): [string, string] => {
  const partes = nome.trim().split(/\s+/);
  return [partes[0] ?? "", partes.slice(1).join(" ")];
};

/** Cabeçalhos e colunas de cada destino, nos nomes que a importação de cada CRM reconhece. */
const COLUNAS: Record<FormatoExportacao, { cabecalho: string; valor: (l: LinhaExportacao) => string | undefined }[]> = {
  padrao: [
    { cabecalho: "Nome", valor: (l) => l.nome },
    { cabecalho: "Cargo", valor: (l) => l.cargo },
    { cabecalho: "E-mail", valor: (l) => l.email },
    { cabecalho: "Telefone", valor: (l) => l.telefone },
    { cabecalho: "LinkedIn", valor: (l) => l.linkedin },
    { cabecalho: "Origem", valor: (l) => l.origem },
    { cabecalho: "Empresa", valor: (l) => l.empresa },
    { cabecalho: "CNPJ", valor: (l) => l.cnpj },
  ],
  hubspot: [
    { cabecalho: "First Name", valor: (l) => separarNome(l.nome)[0] },
    { cabecalho: "Last Name", valor: (l) => separarNome(l.nome)[1] },
    { cabecalho: "Email", valor: (l) => l.email },
    { cabecalho: "Phone Number", valor: (l) => l.telefone },
    { cabecalho: "Job Title", valor: (l) => l.cargo },
    { cabecalho: "Company Name", valor: (l) => l.empresa },
    { cabecalho: "Website URL", valor: (l) => l.site },
    { cabecalho: "LinkedIn", valor: (l) => l.linkedin },
    { cabecalho: "CNPJ", valor: (l) => l.cnpj },
  ],
  rdstation: [
    { cabecalho: "Nome", valor: (l) => l.nome },
    { cabecalho: "Email", valor: (l) => l.email },
    { cabecalho: "Cargo", valor: (l) => l.cargo },
    { cabecalho: "Empresa", valor: (l) => l.empresa },
    { cabecalho: "Telefone", valor: (l) => l.telefone },
    { cabecalho: "Website", valor: (l) => l.site },
    { cabecalho: "LinkedIn", valor: (l) => l.linkedin },
    { cabecalho: "CNPJ", valor: (l) => l.cnpj },
  ],
  pipedrive: [
    { cabecalho: "Person - Name", valor: (l) => l.nome },
    { cabecalho: "Person - Email", valor: (l) => l.email },
    { cabecalho: "Person - Phone", valor: (l) => l.telefone },
    { cabecalho: "Person - Job title", valor: (l) => l.cargo },
    { cabecalho: "Organization - Name", valor: (l) => l.empresa },
    { cabecalho: "Person - LinkedIn", valor: (l) => l.linkedin },
    { cabecalho: "Organization - CNPJ", valor: (l) => l.cnpj },
  ],
};

export const formatoValido = (f: string | null | undefined): FormatoExportacao =>
  (FORMATOS as readonly string[]).includes(f ?? "") ? (f as FormatoExportacao) : "padrao";

/** CSV com BOM (o Excel e os CRMs brasileiros leem acentos), células protegidas contra fórmula de planilha. */
export function montarCsv(formato: FormatoExportacao, linhas: LinhaExportacao[]): string {
  const cols = COLUNAS[formato];
  const corpo = linhas.map((l) => cols.map((c) => celulaCsv(c.valor(l))).join(","));
  return "﻿" + [cols.map((c) => c.cabecalho).join(","), ...corpo].join("\r\n");
}

/** Uma empresa da pesquisa (dados públicos da Receita), para importar como empresa no CRM. */
export interface EmpresaExportacao {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  uf?: string;
  municipio?: string;
  bairro?: string;
  atividade?: string;
  cnae?: number;
  porte?: string;
  abertaEm?: string;
  email?: string;
  telefone?: string;
  site?: string;
}

const COLUNAS_EMPRESA: Record<FormatoExportacao, { cabecalho: string; valor: (e: EmpresaExportacao) => string | undefined }[]> = {
  padrao: [
    { cabecalho: "CNPJ", valor: (e) => e.cnpj },
    { cabecalho: "Razão social", valor: (e) => e.razaoSocial },
    { cabecalho: "Nome fantasia", valor: (e) => e.nomeFantasia },
    { cabecalho: "UF", valor: (e) => e.uf },
    { cabecalho: "Município", valor: (e) => e.municipio },
    { cabecalho: "Bairro", valor: (e) => e.bairro },
    { cabecalho: "Atividade", valor: (e) => e.atividade },
    { cabecalho: "CNAE", valor: (e) => (e.cnae ? String(e.cnae) : undefined) },
    { cabecalho: "Porte", valor: (e) => e.porte },
    { cabecalho: "Abertura", valor: (e) => e.abertaEm },
    { cabecalho: "E-mail cadastral", valor: (e) => e.email },
    { cabecalho: "Telefone cadastral", valor: (e) => e.telefone },
    { cabecalho: "Site", valor: (e) => e.site },
  ],
  hubspot: [
    { cabecalho: "Company name", valor: (e) => e.nomeFantasia || e.razaoSocial },
    { cabecalho: "Company domain name", valor: (e) => e.site },
    { cabecalho: "Phone Number", valor: (e) => e.telefone },
    { cabecalho: "City", valor: (e) => e.municipio },
    { cabecalho: "State/Region", valor: (e) => e.uf },
    { cabecalho: "Industry", valor: (e) => e.atividade },
    { cabecalho: "Razão social", valor: (e) => e.razaoSocial },
    { cabecalho: "CNPJ", valor: (e) => e.cnpj },
  ],
  rdstation: [
    { cabecalho: "Empresa", valor: (e) => e.nomeFantasia || e.razaoSocial },
    { cabecalho: "Razão social", valor: (e) => e.razaoSocial },
    { cabecalho: "CNPJ", valor: (e) => e.cnpj },
    { cabecalho: "Site", valor: (e) => e.site },
    { cabecalho: "Telefone", valor: (e) => e.telefone },
    { cabecalho: "Cidade", valor: (e) => e.municipio },
    { cabecalho: "Estado", valor: (e) => e.uf },
    { cabecalho: "Segmento", valor: (e) => e.atividade },
  ],
  pipedrive: [
    { cabecalho: "Organization - Name", valor: (e) => e.nomeFantasia || e.razaoSocial },
    { cabecalho: "Organization - Address", valor: (e) => [e.bairro, e.municipio, e.uf].filter(Boolean).join(", ") || undefined },
    { cabecalho: "Organization - Phone", valor: (e) => e.telefone },
    { cabecalho: "Organization - Website", valor: (e) => e.site },
    { cabecalho: "Organization - CNPJ", valor: (e) => e.cnpj },
    { cabecalho: "Organization - Segmento", valor: (e) => e.atividade },
  ],
};

/** CSV de empresas (não de pessoas), com os mesmos cuidados: BOM, proteção contra fórmula de planilha. */
export function montarCsvEmpresas(formato: FormatoExportacao, empresas: EmpresaExportacao[]): string {
  const cols = COLUNAS_EMPRESA[formato];
  return "\uFEFF" + [cols.map((c) => c.cabecalho).join(","), ...empresas.map((e) => cols.map((c) => celulaCsv(c.valor(e))).join(","))].join("\r\n");
}
