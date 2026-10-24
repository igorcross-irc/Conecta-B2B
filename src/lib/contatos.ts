import type { Contato } from "./providers/types";

/** Contato guardado no servidor, com os campos pagos ainda ocultos até a revelação. */
export interface ContatoGuardado {
  id: string;
  cnpj: string;
  contato: Contato;
  emailRevelado: boolean;
  telefoneRevelado: boolean;
}

/** O que o cliente vê. E-mail e telefone só aparecem completos depois de revelados. */
export interface ContatoVisivel {
  id: string;
  nome: string;
  cargo: string;
  senioridade?: string;
  departamento?: string;
  linkedinUrl?: string;
  temEmail: boolean;
  emailStatus?: Contato["emailStatus"];
  email?: string;
  emailMascarado?: string;
  temTelefone: boolean;
  telefone?: string;
  telefoneMascarado?: string;
  origem: string;
  obtidoEm: string;
  confianca: number;
}

export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return "***";
  return `${usuario.slice(0, 1)}***@${dominio}`;
}

export function mascararTelefone(tel: string): string {
  const ddd = tel.match(/^\(?(\d{2})\)?/)?.[1];
  return ddd ? `(${ddd}) *****-****` : "*****-****";
}

export function visivel(g: ContatoGuardado): ContatoVisivel {
  const c = g.contato;
  return {
    id: g.id,
    nome: c.nome,
    cargo: c.cargo,
    senioridade: c.senioridade,
    departamento: c.departamento,
    linkedinUrl: c.linkedinUrl,
    temEmail: Boolean(c.email),
    emailStatus: c.emailStatus,
    email: g.emailRevelado ? c.email : undefined,
    emailMascarado: c.email && !g.emailRevelado ? mascararEmail(c.email) : undefined,
    temTelefone: Boolean(c.telefone),
    telefone: g.telefoneRevelado ? c.telefone : undefined,
    telefoneMascarado:
      c.telefone && !g.telefoneRevelado ? mascararTelefone(c.telefone) : undefined,
    origem: c.origem,
    obtidoEm: c.obtidoEm,
    confianca: c.confianca,
  };
}

/** Evita que células de CSV sejam interpretadas como fórmula ao abrir no Excel. */
export function celulaCsv(valor: string | undefined): string {
  let v = valor ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
