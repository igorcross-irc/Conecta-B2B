import type {
  Contato,
  EntradaBuscaContatos,
  ProvedorContatos,
} from "./providers/types";
import { inferirEmails, unirPessoas } from "./pessoas";

export interface Tentativa {
  provedor: string;
  encontrados: number;
  erro?: string;
}

export interface ResultadoCascata {
  contatos: Contato[];
  tentativas: Tentativa[];
}

export interface OpcoesCascata {
  /** Para quando houver pelo menos este número de contatos com e-mail verificado. */
  minimoVerificados?: number;
  /** Retorna true para contatos que pediram exclusão (opt-out). */
  optOut?: (contato: Contato) => boolean;
  /** Chamado antes de consultar cada provedor, para mostrar o andamento. */
  progresso?: (provedor: string) => void | Promise<void>;
}

function chave(c: Contato): string {
  return (c.email ?? `${c.nome}|${c.cargo}`).toLowerCase();
}

/**
 * Enriquecimento em cascata: consulta os provedores na ordem, junta os contatos
 * sem repetir, descarta quem pediu opt-out e para quando há contatos verificados suficientes.
 * Falha de um provedor não derruba os demais.
 */
export async function buscarEmCascata(
  provedores: ProvedorContatos[],
  entrada: EntradaBuscaContatos,
  { minimoVerificados = 3, optOut, progresso }: OpcoesCascata = {},
): Promise<ResultadoCascata> {
  const porChave = new Map<string, Contato>();
  const tentativas: Tentativa[] = [];

  for (const provedor of provedores) {
    await Promise.resolve(progresso?.(provedor.nome)).catch(() => undefined);
    try {
      const encontrados = await provedor.buscar(entrada);
      tentativas.push({ provedor: provedor.nome, encontrados: encontrados.length });
      for (const c of encontrados) {
        if (optOut?.(c)) continue;
        const k = chave(c);
        const atual = porChave.get(k);
        if (!atual || c.confianca > atual.confianca) porChave.set(k, c);
      }
    } catch (e) {
      tentativas.push({
        provedor: provedor.nome,
        encontrados: 0,
        erro: e instanceof Error ? e.message : "erro desconhecido",
      });
    }
    const verificados = [...porChave.values()].filter(
      (c) => c.emailStatus === "verificado",
    ).length;
    if (verificados >= minimoVerificados) break;
  }

  // Mesma pessoa em fontes diferentes vira um contato só, com mais dados e mais confiança.
  const unidos = inferirEmails(unirPessoas([...porChave.values()]), entrada.empresa.dominio);
  const contatos = unidos.sort((a, b) => b.confianca - a.confianca);
  return { contatos, tentativas };
}
