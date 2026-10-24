import { TABELA_CUSTOS_PADRAO, type Lancamento, type TabelaCustos } from "./credits";
import { Linha } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "creditos". */
export function criarCreditos(c: Ctx) {
  const { db, org, um, saldo } = c;
  return {
    saldo,
    /** Custos do tenant (config_tenant), com os valores padrão para o que não estiver configurado. */
    async custos(): Promise<TabelaCustos> {
      const r = await um<{ custos: Partial<TabelaCustos> }>(
        "select custos from config_tenant where organizacao_id = $1",
        [org],
      );
      return { ...TABELA_CUSTOS_PADRAO, ...(r?.custos ?? {}) };
    },
    async extrato(): Promise<Lancamento[]> {
      const r = await db.query<Linha>(
        "select * from credito_lancamento where organizacao_id = $1 order by criado_em desc, valor desc, id",
        [org],
      );
      return r.rows.map((l) => ({
        id: l.id as string,
        operacao: l.operacao as Lancamento["operacao"],
        valor: Number(l.valor),
        saldoApos: Number(l.saldo_apos),
        descricao: l.descricao as string,
        chave: (l.chave as string) ?? undefined,
        estornaId: (l.estorna_id as string) ?? undefined,
        criadoEm: new Date(l.criado_em as string).toISOString(),
      }));
    },
  };
}
