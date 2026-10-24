import type { Db } from "@/db/conexao";
import { buscarCvm } from "./cvm";
import { buscarNoticias } from "./noticias";
import { buscarSancoes, sancoesConfiguradas } from "./sancoes";
import type { Enriquecimento, FonteEnriquecimento } from "./tipos";
import { buscarWikidata, simplificarNome } from "./wikidata";

export * from "./tipos";

/** Quanto tempo cada fonte fica em cache (segundos). Notícias envelhecem rápido; cadastro de companhia quase não muda. */
export const VALIDADE_S: Record<FonteEnriquecimento, number> = { cvm: 7 * 86400, wikidata: 30 * 86400, noticias: 6 * 3600, sancoes: 86400 };

interface Alvo {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  dominio?: string;
}

export interface DepsEnriquecimento {
  http?: typeof fetch;
  agora?: () => Date;
}

/**
 * Consulta as fontes em paralelo, cada uma com o próprio cache (tabela enriquecimento_cache) e a própria falha:
 * uma fonte fora do ar vira uma mensagem em `erros`, nunca derruba a ficha.
 */
export async function enriquecer(db: Db, alvo: Alvo, { http, agora = () => new Date() }: DepsEnriquecimento = {}): Promise<Enriquecimento> {
  const erros: Record<string, string> = {};

  async function comCache<T>(fonte: FonteEnriquecimento, buscar: () => Promise<T>): Promise<T | undefined> {
    try {
      const c = await db.query<{ dados: { v: T } }>(
        "select dados from enriquecimento_cache where cnpj = $1 and fonte = $2 and obtido_em > now() - make_interval(secs => $3)",
        [alvo.cnpj, fonte, VALIDADE_S[fonte]],
      );
      if (c.rows[0]) return c.rows[0].dados.v;
      const v = await buscar();
      await db.query(
        `insert into enriquecimento_cache (cnpj, fonte, dados, obtido_em) values ($1, $2, $3::jsonb, now())
         on conflict (cnpj, fonte) do update set dados = excluded.dados, obtido_em = excluded.obtido_em`,
        [alvo.cnpj, fonte, JSON.stringify({ v })],
      );
      return v;
    } catch (e) {
      erros[fonte] = e instanceof Error ? e.message : "Falha ao consultar.";
      return undefined;
    }
  }

  const termoNoticia = alvo.nomeFantasia && alvo.nomeFantasia.length >= 4 ? alvo.nomeFantasia : simplificarNome(alvo.razaoSocial);
  const [cvm, wikidata, noticias, sancoes] = await Promise.all([
    alvo.cnpj.match(/^\d{14}$/) ? comCache("cvm", async () => (await buscarCvm(alvo.cnpj, http)) ?? null) : Promise.resolve(undefined),
    alvo.cnpj.match(/^\d{14}$/) ? comCache("wikidata", async () => (await buscarWikidata(alvo, http)) ?? null) : Promise.resolve(undefined),
    termoNoticia ? comCache("noticias", () => buscarNoticias(termoNoticia, http)) : Promise.resolve(undefined),
    alvo.cnpj.match(/^\d{14}$/) && sancoesConfiguradas() ? comCache("sancoes", () => buscarSancoes(alvo.cnpj, http)) : Promise.resolve(undefined),
  ]);
  return { cvm, wikidata, noticias, sancoes, erros, obtidoEm: agora().toISOString() };
}
