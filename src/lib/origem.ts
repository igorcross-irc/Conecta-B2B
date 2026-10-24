/**
 * Traduz o texto de origem de um contato (guardado para a LGPD e a auditoria) em etiquetas que a pessoa entende:
 * de onde veio cada dado e se é confirmado ou palpite. A origem junta várias fontes com " + ".
 */
export type TomOrigem = "oficial" | "site" | "web" | "terceiro" | "palpite" | "comunidade" | "demonstracao";
export interface EtiquetaOrigem {
  rotulo: string;
  tom: TomOrigem;
  /** Frase completa para explicar a etiqueta. */
  explicacao: string;
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function uma(parte: string): EtiquetaOrigem[] {
  const t = parte.trim();
  if (!t) return [];
  if (/\(base comum\)\s*$/i.test(t)) {
    return [
      ...uma(t.replace(/\s*\(base comum\)\s*$/i, "")),
      { rotulo: "Base comum", tom: "comunidade", explicacao: "Contato guardado na base comum da plataforma, contribuído por outro cliente. Pode estar desatualizado." },
    ];
  }
  if (/— QSA|QSA\)?$/i.test(t)) return [{ rotulo: "Sócio na Receita Federal", tom: "oficial", explicacao: "Consta no quadro societário público da empresa. Confirma que a pessoa existe e é sócia; não traz e-mail nem telefone." }];
  if (/^CVM/i.test(t)) return [{ rotulo: "Diretor de RI (CVM)", tom: "oficial", explicacao: "Responsável por relações com investidores, cadastrado na CVM. E-mail e telefone são institucionais e públicos." }];
  if (/^Busca na web:/i.test(t)) return [{ rotulo: `Citado em ${host(t.replace(/^Busca na web:\s*/i, ""))}`, tom: "web", explicacao: "Pessoa citada numa página da web e extraída por IA. Confira na página antes de usar: pode ser homônimo ou estar desatualizado." }];
  if (/^Site\b/i.test(t)) return [{ rotulo: "Publicado no site da empresa", tom: "site", explicacao: "Encontrado nas páginas públicas do site da empresa. Dado defasado e de precisão média." }];
  if (/^Hunter/i.test(t)) return [{ rotulo: "Hunter.io", tom: "terceiro", explicacao: "Fornecido pelo Hunter.io, um serviço de terceiros que cataloga e-mails de empresas." }];
  if (/e-?mail inferido/i.test(t)) return [{ rotulo: "E-mail adivinhado", tom: "palpite", explicacao: "O e-mail foi montado a partir do padrão que a empresa usa. Não foi confirmado e pode não existir." }];
  if (/demonstra/i.test(t)) return [{ rotulo: "Dado fictício (demonstração)", tom: "demonstracao", explicacao: "Pessoa inventada para demonstrar o sistema." }];
  return [{ rotulo: t, tom: "terceiro", explicacao: `Fonte: ${t}.` }];
}

export function descreverOrigem(origem: string): EtiquetaOrigem[] {
  const vistos = new Set<string>();
  return origem.split(" + ").flatMap(uma).filter((e) => (vistos.has(e.rotulo) ? false : (vistos.add(e.rotulo), true)));
}

/** Nível de confiança em palavras, com a razão em uma frase. */
export function nivelDeConfianca(confianca: number, etiquetas: EtiquetaOrigem[]): { nivel: "alta" | "media" | "baixa"; rotulo: string; razao: string } {
  const nivel = confianca >= 0.7 ? "alta" : confianca >= 0.45 ? "media" : "baixa";
  const fontes = etiquetas.filter((e) => e.tom !== "palpite" && e.tom !== "comunidade").length;
  const razao =
    nivel === "alta"
      ? `${fontes > 1 ? "Mais de uma fonte concorda" : "Fonte confiável"} sobre esta pessoa.`
      : nivel === "media"
        ? "Uma fonte indica esta pessoa; vale conferir antes de abordar."
        : "Pouca evidência: use como pista, não como certeza.";
  return { nivel, rotulo: nivel === "alta" ? "Confiança alta" : nivel === "media" ? "Confiança média" : "Confiança baixa", razao };
}
