import { ABERTURAS, PORTES, SETORES } from "./setores";
import type { PesquisaFiltros } from "./servicosPg.tipos";

/** Parâmetros da URL do Next (`searchParams`) como URLSearchParams, mantendo valores repetidos (ex.: vários `setor`). */
export function paraBusca(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, x);
  return q;
}

/**
 * Filtros da pesquisa de empresas a partir dos parâmetros da URL. É o ÚNICO lugar que traduz URL em filtros: a tela de
 * Pesquisa, o Mercado, a exportação de planilha e a API pública usam esta função, então um filtro novo entra aqui uma vez.
 * Só guarda valores conhecidos (setores, portes e aberturas são listas fechadas) e com tamanho limitado.
 */
export function filtrosDaUrl(q: URLSearchParams): PesquisaFiltros & { pagina: number } {
  const t = (k: string, max = 120) => q.get(k)?.trim().slice(0, max) || undefined;
  const ordem = q.get("ordem");
  return {
    nome: t("nome"), termos: t("termos"), uf: t("uf", 2)?.toUpperCase(), cidade: t("cidade"), bairro: t("bairro"), segmento: t("segmento"),
    setores: q.getAll("setor").filter((x) => SETORES.some((s) => s.id === x)).slice(0, 30),
    porte: q.getAll("porte").filter((x) => (PORTES as readonly string[]).includes(x)),
    abertura: ABERTURAS.some((a) => a.id === q.get("abertura")) ? q.get("abertura")! : undefined,
    comEmail: q.get("email") === "1",
    comTelefone: q.get("telefone") === "1",
    incluirFiliais: q.get("filiais") === "1",
    ordem: ordem === "recentes" || ordem === "aderencia" ? ordem : "nome",
    pagina: Math.max(0, Math.min(399, Math.floor(Number(q.get("pagina")) || 0))),
  };
}
