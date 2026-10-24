import { buscarCvm, contatoDeRi } from "../enriquecimento/cvm";
import type { Contato, EntradaBuscaContatos, ProvedorContatos } from "./types";

/** Fonte gratuita para companhias abertas: o Diretor de RI cadastrado na CVM, com e-mail e telefone institucionais publicados. */
export class CvmRelacoesInvestidores implements ProvedorContatos {
  nome = "CVM (Diretor de Relações com Investidores)";
  constructor(private http?: typeof fetch) {}

  async buscar({ empresa }: EntradaBuscaContatos): Promise<Contato[]> {
    if (!/^\d{14}$/.test(empresa.cnpj)) return [];
    const info = await buscarCvm(empresa.cnpj, this.http);
    return info ? contatoDeRi(info) : [];
  }
}
