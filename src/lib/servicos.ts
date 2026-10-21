import { buscarEmCascata } from "./cascade";
import {
  Razao,
  SaldoInsuficienteError,
  TABELA_CUSTOS_PADRAO,
  type TabelaCustos,
} from "./credits";
import { cnpjValido, somenteDigitos } from "./cnpj";
import type {
  Contato,
  Empresa,
  ProvedorContatos,
  ProvedorEmpresa,
} from "./providers/types";

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

export interface Lista {
  id: string;
  nome: string;
  contatoIds: string[];
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

export class ErroDeNegocio extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ErroDeNegocio";
  }
}

interface Dependencias {
  empresa: ProvedorEmpresa;
  contatos: ProvedorContatos[];
  razao: Razao;
  custos?: TabelaCustos;
}

export function criarServicos({
  empresa: provedorEmpresa,
  contatos: provedoresContatos,
  razao,
  custos = TABELA_CUSTOS_PADRAO,
}: Dependencias) {
  const guardados = new Map<string, ContatoGuardado>();
  const listas = new Map<string, Lista>();
  const optOut = new Set<string>();
  let seq = 0;

  const obter = (id: string) => {
    const g = guardados.get(id);
    if (!g) throw new ErroDeNegocio("Contato não encontrado.", 404);
    return g;
  };

  return {
    saldo: () => razao.saldoAtual,
    extrato: () => razao.extrato(),
    custos: () => custos,

    async consultarEmpresa(cnpj: string): Promise<Empresa> {
      if (!cnpjValido(cnpj)) throw new ErroDeNegocio("CNPJ inválido.");
      const e = await provedorEmpresa.buscarPorCnpj(cnpj);
      if (!e) throw new ErroDeNegocio("Empresa não encontrada.", 404);
      return e;
    },

    /** Busca decisores. Cobra 1 busca e estorna se nada for encontrado. */
    async buscarDecisores(params: {
      cnpj: string;
      cargos: string[];
      chave: string;
    }): Promise<{ contatos: ContatoVisivel[]; tentativas: unknown[]; saldo: number }> {
      const empresa = await this.consultarEmpresa(params.cnpj);
      let cobranca;
      try {
        cobranca = razao.cobrar(
          "busca_decisores",
          custos.busca_decisores,
          `Busca de decisores: ${empresa.razaoSocial}`,
          `busca:${params.chave}`,
        );
      } catch (e) {
        if (e instanceof SaldoInsuficienteError) {
          throw new ErroDeNegocio("Saldo de créditos insuficiente.", 402);
        }
        throw e;
      }
      const cargos = params.cargos.map((c) => c.trim().toLowerCase()).filter(Boolean);
      const { contatos, tentativas } = await buscarEmCascata(
        provedoresContatos,
        { empresa, cargos },
        { optOut: (c) => Boolean(c.email && optOut.has(c.email.toLowerCase())) },
      );
      if (contatos.length === 0) {
        razao.estornar(cobranca.id, "nenhum decisor encontrado");
      }
      const visiveis = contatos.map((contato) => {
        const existente = [...guardados.values()].find(
          (g) =>
            g.cnpj === somenteDigitos(params.cnpj) &&
            g.contato.nome === contato.nome &&
            g.contato.cargo === contato.cargo,
        );
        if (existente) return visivel(existente);
        const g: ContatoGuardado = {
          id: `c_${++seq}`,
          cnpj: somenteDigitos(params.cnpj),
          contato,
          emailRevelado: false,
          telefoneRevelado: false,
        };
        guardados.set(g.id, g);
        return visivel(g);
      });
      return { contatos: visiveis, tentativas, saldo: razao.saldoAtual };
    },

    /** Revela e-mail ou telefone. Só cobra se o dado existe; repetir a chamada não cobra de novo. */
    revelar(params: {
      contatoId: string;
      campo: "email" | "telefone";
    }): { contato: ContatoVisivel; saldo: number } {
      const g = obter(params.contatoId);
      const existe = params.campo === "email" ? g.contato.email : g.contato.telefone;
      if (!existe) {
        throw new ErroDeNegocio("Este contato não tem esse dado. Nada foi cobrado.", 404);
      }
      const jaRevelado =
        params.campo === "email" ? g.emailRevelado : g.telefoneRevelado;
      if (!jaRevelado) {
        const operacao =
          params.campo === "email" ? "revelar_email" : "revelar_telefone";
        try {
          razao.cobrar(
            operacao,
            custos[operacao],
            `Revelar ${params.campo}: ${g.contato.nome}`,
            `rev:${g.id}:${params.campo}`,
          );
        } catch (e) {
          if (e instanceof SaldoInsuficienteError) {
            throw new ErroDeNegocio("Saldo de créditos insuficiente.", 402);
          }
          throw e;
        }
        if (params.campo === "email") g.emailRevelado = true;
        else g.telefoneRevelado = true;
      }
      return { contato: visivel(g), saldo: razao.saldoAtual };
    },

    criarLista(nome: string): Lista {
      const limpo = nome.trim();
      if (!limpo) throw new ErroDeNegocio("Dê um nome à lista.");
      const lista: Lista = { id: `lista_${listas.size + 1}`, nome: limpo, contatoIds: [] };
      listas.set(lista.id, lista);
      return lista;
    },

    listas: () => [...listas.values()],

    /** Listas guardam referências aos contatos, sem copiar dados. */
    adicionarALista(listaId: string, contatoIds: string[]): Lista {
      const lista = listas.get(listaId);
      if (!lista) throw new ErroDeNegocio("Lista não encontrada.", 404);
      for (const id of contatoIds) {
        obter(id);
        if (!lista.contatoIds.includes(id)) lista.contatoIds.push(id);
      }
      return lista;
    },

    contatosDaLista(listaId: string): ContatoVisivel[] {
      const lista = listas.get(listaId);
      if (!lista) throw new ErroDeNegocio("Lista não encontrada.", 404);
      return lista.contatoIds.map((id) => visivel(obter(id)));
    },

    /** Exporta só o que já foi revelado; nada pago vaza no arquivo. */
    exportarCsv(listaId: string): string {
      const linhas = this.contatosDaLista(listaId).map((c) =>
        [c.nome, c.cargo, c.email, c.telefone, c.linkedinUrl, c.origem]
          .map(celulaCsv)
          .join(","),
      );
      return ["Nome,Cargo,E-mail,Telefone,LinkedIn,Origem", ...linhas].join("\n");
    },

    /** Opt-out: o e-mail não volta mais em buscas futuras. */
    registrarOptOut(email: string): void {
      const e = email.trim().toLowerCase();
      if (!e.includes("@")) throw new ErroDeNegocio("E-mail inválido.");
      optOut.add(e);
    },
  };
}

export type Servicos = ReturnType<typeof criarServicos>;
