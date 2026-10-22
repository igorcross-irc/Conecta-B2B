import type { Contato, EntradaBuscaContatos, ProvedorContatos } from "./types";

/** Qualificações do QSA que indicam quem decide na empresa. */
const DECISORES = /administrador|diretor|presidente|s[óo]cio|titular|gerente|procurador/i;

function senioridade(q: string): string {
  if (/presidente|diretor/i.test(q)) return "Diretoria";
  if (/gerente/i.test(q)) return "Gerência";
  return "Sócio / administração";
}

/**
 * Fonte gratuita de decisores: sócios e administradores do quadro societário da Receita.
 * Serve bem para empresas pequenas e médias, onde o sócio é quem decide. Não traz e-mail nem telefone
 * de pessoa; o contato vem do site (ver site.ts) ou de provedores pagos depois.
 */
export class SociosReceita implements ProvedorContatos {
  nome = "Quadro societário (Receita Federal)";

  async buscar({ empresa }: EntradaBuscaContatos): Promise<Contato[]> {
    return empresa.socios
      .filter((s) => s.nome && !s.nome.includes("[MASKED]") && DECISORES.test(s.qualificacao))
      .map((s) => ({
        nome: s.nome,
        cargo: s.qualificacao,
        senioridade: senioridade(s.qualificacao),
        origem: `${empresa.fonte} — QSA`,
        obtidoEm: empresa.obtidoEm,
        // Sabemos que a pessoa existe e é sócia; não sabemos como falar com ela.
        confianca: 0.5,
      }));
  }
}
