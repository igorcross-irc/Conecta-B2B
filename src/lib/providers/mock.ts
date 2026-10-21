import type {
  Contato,
  Empresa,
  ProvedorEmpresa,
  EntradaBuscaContatos,
  ProvedorContatos,
} from "./types";

/**
 * Provedor de demonstração. Gera pessoas FICTÍCIAS com e-mails em exemplo.com.br,
 * para o fluxo funcionar sem chaves de provedores. Nunca inventa contato de pessoa real.
 * Será substituído por Apollo, People Data Labs, FullEnrich etc. quando houver chaves.
 */
const MODELOS: Omit<Contato, "origem" | "obtidoEm">[] = [
  {
    nome: "Pessoa Exemplo A",
    cargo: "Diretor Comercial",
    senioridade: "Diretoria",
    departamento: "Vendas",
    email: "pessoa.a@exemplo.com.br",
    emailStatus: "verificado",
    telefone: "(11) 90000-0001",
    linkedinUrl: "https://www.linkedin.com/in/exemplo-a",
    confianca: 0.9,
  },
  {
    nome: "Pessoa Exemplo B",
    cargo: "Gerente de Marketing",
    senioridade: "Gerência",
    departamento: "Marketing",
    email: "pessoa.b@exemplo.com.br",
    emailStatus: "nao_verificado",
    confianca: 0.6,
  },
  {
    nome: "Pessoa Exemplo C",
    cargo: "Coordenadora de Compras",
    senioridade: "Coordenação",
    departamento: "Operações",
    confianca: 0.4,
  },
];

export class ProvedorDemo implements ProvedorContatos {
  nome = "demonstração (dados fictícios)";

  async buscar({ cargos }: EntradaBuscaContatos): Promise<Contato[]> {
    const agora = new Date().toISOString();
    const filtrados = MODELOS.filter(
      (m) =>
        cargos.length === 0 ||
        cargos.some(
          (c) =>
            m.cargo.toLowerCase().includes(c) ||
            (m.departamento ?? "").toLowerCase().includes(c),
        ),
    );
    return filtrados.map((m) => ({
      ...m,
      origem: this.nome,
      obtidoEm: agora,
    }));
  }
}

/** Empresa FICTÍCIA para qualquer CNPJ válido, para rodar sem internet (CONECTA_MODO_DEMO=1). */
export class EmpresaDemo implements ProvedorEmpresa {
  nome = "demonstração (dados fictícios)";

  async buscarPorCnpj(cnpj: string): Promise<Empresa> {
    return {
      cnpj,
      razaoSocial: "EMPRESA DE DEMONSTRACAO LTDA",
      nomeFantasia: "Empresa Demonstração",
      situacao: "Ativa",
      porte: "Demais",
      municipio: "São Paulo",
      uf: "SP",
      cnaePrincipal: { codigo: 1091101, descricao: "Fabricação de produtos de panificação" },
      telefones: [],
      emailsCadastrais: [],
      dominio: "exemplo.com.br",
      socios: [],
      fonte: this.nome,
      obtidoEm: new Date().toISOString(),
    };
  }
}
