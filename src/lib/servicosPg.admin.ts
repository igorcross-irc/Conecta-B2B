import { estadoDaFonte } from "./monitor";
import { TABELA_CUSTOS_PADRAO, type TabelaCustos } from "./credits";
import { ErroDeNegocio } from "./erros";
import { Linha, ResumoProvedor, UUID } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "admin". */
export function criarAdmin(c: Ctx) {
  const { db, ator, exigirOperadora, um, servicos } = c;
  return {
    async adminResumo() {
      exigirOperadora();
      const n = async (sql: string) => Number((await um<{ n: number }>(sql))!.n);
      return {
        organizacoes: await n("select count(*)::int as n from organizacao"),
        usuarios: await n("select count(distinct usuario_id)::int as n from membro"),
        empresasNaBase: await n("select count(*)::int as n from empresa_cache"),
        varreduras: await n("select count(*)::int as n from pool_busca"),
        contatosNoPool: await n("select coalesce(sum(jsonb_array_length(contatos)),0)::int as n from pool_busca"),
        contatosDaComunidade: await n("select count(*)::int as n from base_contato"),
        buscas30d: await n("select count(*)::int as n from busca_job where criado_em > now() - interval '30 days'"),
        optOuts: await n("select count(*)::int as n from opt_out"),
      };
    },
    async adminOrganizacoes() {
      exigirOperadora();
      const r = await db.query<Linha>(
        `select o.id, o.nome, o.criado_em, c.custos,
                (select count(*)::int from membro m where m.organizacao_id = o.id) as membros,
                (select count(*)::int from busca_job j where j.organizacao_id = o.id) as buscas,
                saldo_creditos(o.id) as saldo,
                (select string_agg(u.email, ', ' order by u.email) from membro m2 join neon_auth."user" u on u.id = m2.usuario_id where m2.organizacao_id = o.id and m2.papel = 'administrador') as admins
           from organizacao o left join config_tenant c on c.organizacao_id = o.id order by o.criado_em desc limit 200`,
      );
      return r.rows.map((x) => ({
        id: x.id as string,
        nome: x.nome as string,
        criadaEm: new Date(x.criado_em as string).toISOString(),
        membros: Number(x.membros),
        buscas: Number(x.buscas),
        saldo: Number(x.saldo),
        admins: (x.admins as string) ?? "",
        custos: { ...TABELA_CUSTOS_PADRAO, ...((x.custos as Partial<TabelaCustos>) ?? {}) },
      }));
    },
    async adminRecarregar(orgId: string, valor: number, descricao: string) {
      exigirOperadora();
      if (!UUID.test(orgId)) throw new ErroDeNegocio("Organização não encontrada.", 404);
      if (!Number.isInteger(valor) || valor <= 0 || valor > 100000) throw new ErroDeNegocio("Informe um valor inteiro entre 1 e 100000.");
      await db.query("select recarregar_creditos($1,$2,$3)", [orgId, valor, descricao]);
      await db.query(
        "insert into auditoria (usuario_id, organizacao_id, acao, alvo, detalhe) values ($1,$2::uuid,'admin.recarga',$2::text,$3::jsonb)",
        [ator.usuarioId, orgId, JSON.stringify({ valor, descricao })],
      );
    },
    async adminAtualizarCustos(orgId: string, custos: TabelaCustos) {
      exigirOperadora();
      if (!UUID.test(orgId)) throw new ErroDeNegocio("Organização não encontrada.", 404);
      for (const v of Object.values(custos)) {
        if (!Number.isInteger(v) || v < 1 || v > 1000) throw new ErroDeNegocio("Cada custo deve ser um inteiro entre 1 e 1000.");
      }
      await db.query(
        `insert into config_tenant (organizacao_id, custos) values ($1,$2::jsonb)
         on conflict (organizacao_id) do update set custos = excluded.custos`,
        [orgId, JSON.stringify(custos)],
      );
      await db.query(
        "insert into auditoria (usuario_id, organizacao_id, acao, alvo, detalhe) values ($1,$2::uuid,'admin.custos',$2::text,$3::jsonb)",
        [ator.usuarioId, orgId, JSON.stringify(custos)],
      );
    },
    /** Saúde de cada fonte de dados: sucesso, tempo e último erro, nas últimas 24 h e 7 dias. */
    /**
     * Chamado pelo cron (não por pessoas): se alguma fonte ficou "fora do ar" nas últimas 24 h (com ao menos 5 chamadas),
     * manda um resumo por e-mail para a operadora. Sem fontes fora, não manda nada.
     */
    async avisarFontesForaDoAr(enviar: (m: { para: string; assunto: string; texto: string }) => Promise<void>, para: string, urlBase: string) {
      const r = await db.query<Linha>(
        `select provedor, tipo, count(*)::int as n, count(*) filter (where not ok)::int as falhas,
                (array_agg(erro order by criado_em desc) filter (where not ok))[1] as ultimo_erro
           from provedor_execucao where criado_em > now() - interval '24 hours'
          group by provedor, tipo order by provedor`,
      );
      const fora = r.rows.filter((x) => Number(x.n) >= 5 && estadoDaFonte(Number(x.n), Number(x.falhas)) === "fora");
      if (fora.length === 0) return { foraDoAr: 0, enviado: false };
      const linhas = fora.map((x) => `- ${x.provedor} (${x.tipo}): ${x.falhas} falhas em ${x.n} chamadas. Último erro: ${String(x.ultimo_erro ?? "sem mensagem").slice(0, 160)}`);
      await enviar({
        para,
        assunto: `Conecta B2B: ${fora.length} fonte(s) de dados fora do ar`,
        texto: `Nas últimas 24 horas, estas fontes falharam em mais de 30% das chamadas:\n\n${linhas.join("\n")}\n\nDetalhes: ${urlBase}/admin/provedores`,
      });
      return { foraDoAr: fora.length, enviado: true };
    },
    async adminProvedores(): Promise<ResumoProvedor[]> {
      exigirOperadora();
      const r = await db.query<Linha>(
        `select provedor, tipo,
                count(*) filter (where criado_em > now() - interval '24 hours')::int as n24,
                count(*) filter (where criado_em > now() - interval '24 hours' and not ok)::int as falhas24,
                count(*)::int as n7,
                count(*) filter (where not ok)::int as falhas7,
                (percentile_cont(0.5) within group (order by ms) filter (where criado_em > now() - interval '24 hours'))::int as p50,
                (percentile_cont(0.95) within group (order by ms) filter (where criado_em > now() - interval '24 hours'))::int as p95,
                max(criado_em) filter (where ok) as ultimo_ok,
                max(criado_em) filter (where not ok) as ultima_falha,
                (array_agg(erro order by criado_em desc) filter (where not ok))[1] as ultimo_erro,
                (avg(itens) filter (where ok and itens is not null and criado_em > now() - interval '7 days'))::float as itens_medio
           from provedor_execucao
          where criado_em > now() - interval '7 days'
          group by provedor, tipo order by provedor`,
      );
      const data = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);
      return r.rows.map((x) => ({
        provedor: x.provedor as string, tipo: x.tipo as string,
        chamadas24h: Number(x.n24), falhas24h: Number(x.falhas24), chamadas7d: Number(x.n7), falhas7d: Number(x.falhas7),
        p50: x.p50 == null ? undefined : Number(x.p50), p95: x.p95 == null ? undefined : Number(x.p95),
        ultimoSucesso: data(x.ultimo_ok), ultimaFalha: data(x.ultima_falha), ultimoErro: (x.ultimo_erro as string) ?? undefined,
        itensMedio: x.itens_medio == null ? undefined : Number(x.itens_medio),
      }));
    },
    /** Falhas mais recentes de fontes de dados, para investigar. */
    async adminFalhasProvedores(limite = 30) {
      exigirOperadora();
      const r = await db.query<Linha>(
        "select provedor, tipo, ms, erro, criado_em from provedor_execucao where not ok order by criado_em desc limit $1",
        [Math.min(100, Math.max(1, limite))],
      );
      return r.rows.map((x) => ({ provedor: x.provedor as string, tipo: x.tipo as string, ms: Number(x.ms), erro: (x.erro as string) ?? "", quando: new Date(x.criado_em as string).toISOString() }));
    },
    /** Erros inesperados do app (rotas e telas), mais recentes primeiro. */
    async adminErros(limite = 50) {
      exigirOperadora();
      const r = await db.query<Linha>("select id, origem, mensagem, detalhe, criado_em from erro_app order by criado_em desc limit $1", [Math.min(200, Math.max(1, limite))]);
      return r.rows.map((x) => ({ id: Number(x.id), origem: x.origem as string, mensagem: x.mensagem as string, detalhe: (x.detalhe as string) ?? undefined, quando: new Date(x.criado_em as string).toISOString() }));
    },
    /** Números de saúde do sistema: banco, base da Receita, caches e falhas recentes. */
    async adminSaude() {
      exigirOperadora();
      const n = async (sql: string) => Number((await um<{ n: number | string }>(sql))?.n ?? 0);
      return {
        bancoBytes: await n("select pg_database_size(current_database())::bigint as n"),
        // Estimativa do planejador (instantânea); contar 2 milhões de linhas a cada abertura da tela seria lento.
        empresasReceita: await (async () => {
          const estimativa = await n("select coalesce((select reltuples::bigint from pg_class where relname = 'rf_estabelecimento'), 0) as n");
          // Tabela nunca analisada devolve -1: conta de verdade (só acontece até o banco rodar a primeira análise).
          return estimativa >= 0 ? estimativa : n("select count(*)::int as n from rf_estabelecimento");
        })(),
        empresasEmCache: await n("select count(*)::int as n from empresa_cache"),
        erros24h: await n("select count(*)::int as n from erro_app where criado_em > now() - interval '24 hours'"),
        falhasFontes24h: await n("select count(*)::int as n from provedor_execucao where not ok and criado_em > now() - interval '24 hours'"),
        chamadasFontes24h: await n("select count(*)::int as n from provedor_execucao where criado_em > now() - interval '24 hours'"),
        buscasEmAndamento: await n("select count(*)::int as n from busca_job where status = 'em_andamento'"),
        cobertura: await servicos.cobertura().catch(() => []),
      };
    },
  };
}
