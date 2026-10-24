import { celulaCsv } from "./servicos";

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
  ],
  rdstation: [
    { cabecalho: "Nome", valor: (l) => l.nome },
    { cabecalho: "Email", valor: (l) => l.email },
    { cabecalho: "Cargo", valor: (l) => l.cargo },
    { cabecalho: "Empresa", valor: (l) => l.empresa },
    { cabecalho: "Telefone", valor: (l) => l.telefone },
    { cabecalho: "Website", valor: (l) => l.site },
    { cabecalho: "LinkedIn", valor: (l) => l.linkedin },
  ],
  pipedrive: [
    { cabecalho: "Person - Name", valor: (l) => l.nome },
    { cabecalho: "Person - Email", valor: (l) => l.email },
    { cabecalho: "Person - Phone", valor: (l) => l.telefone },
    { cabecalho: "Person - Job title", valor: (l) => l.cargo },
    { cabecalho: "Organization - Name", valor: (l) => l.empresa },
    { cabecalho: "Person - LinkedIn", valor: (l) => l.linkedin },
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
