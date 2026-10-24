import { alvoValido, chaveAlvo } from "./cnpj";
import { ErroDeNegocio, visivel } from "./servicos";
import { EstadoBusca, Linha, UUID, VALIDADE_SQL, traduzir } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "buscas". */
export function criarBuscas(c: Ctx) {
  const { db, org, um, guardados, saldo, cobrar, fonteChave, coletar, concluirOuEstornar, falharBusca, varrerBuscasPerdidas, estadoDoJob, servicos } = c;
  return {
    /** Quantos contatos já estão no pool para esta empresa (grátis: é a prévia antes de gastar crédito). */
    async disponiveisNoPool(cnpj: string): Promise<number> {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const d = chaveAlvo(cnpj);
      const r = await um<{ n: number | null }>(
        `select max(jsonb_array_length(contatos))::int as n from pool_busca
          where cnpj = $1 and fonte_chave = $2 and obtido_em > now() - (${VALIDADE_SQL})`,
        [d, fonteChave],
      );
      const c = await um<{ n: number }>("select count(*)::int as n from base_contato where cnpj = $1", [d]);
      return (r?.n ?? 0) + (c?.n ?? 0);
    },
    /** Busca síncrona (espera o resultado). A interface com tela usa iniciarBusca + statusBusca. */
    async buscarDecisores(params: { cnpj: string; cargos: string[]; chave: string }) {
      const empresa = await servicos.consultarEmpresa(params.cnpj);
      const cobranca = await cobrar(
        "busca_decisores",
        (await servicos.custos()).busca_decisores,
        `Busca de decisores: ${empresa.razaoSocial}`,
        `busca:${params.chave}`,
      );
      const { contatos, tentativas } = await coletar(empresa, params.cargos);
      const ids = await concluirOuEstornar(chaveAlvo(params.cnpj), contatos, cobranca.id);
      return {
        contatos: (await guardados(ids)).map(visivel),
        tentativas,
        saldo: await saldo(),
      };
    },
    /**
     * Cria a busca em segundo plano e cobra o crédito. Quem chama deve agendar executarBusca(id)
     * para depois da resposta. Mesma chave devolve a mesma busca, sem cobrar de novo.
     */
    async iniciarBusca(params: { cnpj: string; cargos: string[]; chave: string }): Promise<EstadoBusca> {
      if (!alvoValido(params.cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const cnpj = chaveAlvo(params.cnpj);
      const existente = await um<Linha>("select id from busca_job where organizacao_id = $1 and chave = $2", [
        org,
        params.chave,
      ]);
      if (existente) return servicos.statusBusca(existente.id as string);
      await varrerBuscasPerdidas();
      const emAndamento = await um<Linha>(
        "select id from busca_job where organizacao_id = $1 and cnpj = $2 and status = 'em_andamento'",
        [org, cnpj],
      );
      if (emAndamento) throw new ErroDeNegocio("Já estamos buscando os contatos desta empresa.", 409);

      const empresa = await servicos.consultarEmpresa(cnpj);
      const cargos = params.cargos.map((c) => c.trim().toLowerCase()).filter(Boolean);
      let job: { id: string };
      try {
        job = (await um<{ id: string }>(
          "insert into busca_job (organizacao_id, cnpj, cargos, chave, etapa) values ($1,$2,$3,$4,$5) returning id",
          [org, cnpj, cargos, params.chave, "Na fila"],
        ))!;
      } catch {
        throw new ErroDeNegocio("Já estamos buscando os contatos desta empresa.", 409);
      }
      try {
        const cobranca = await cobrar(
          "busca_decisores",
          (await servicos.custos()).busca_decisores,
          `Busca de decisores: ${empresa.razaoSocial}`,
          `busca:${params.chave}`,
        );
        await db.query("update busca_job set cobranca_id = $2 where id = $1", [job.id, cobranca.id]);
      } catch (e) {
        await db.query("update busca_job set status = 'erro', erro = $2, etapa = 'Não iniciada' where id = $1", [
          job.id,
          e instanceof Error ? e.message : "Falha ao cobrar.",
        ]);
        throw e;
      }
      return servicos.statusBusca(job.id);
    },
    /** Executa a busca de um trabalho já criado. Nunca lança: falhas viram status "erro" com estorno. */
    async executarBusca(jobId: string): Promise<void> {
      const job = await um<Linha>("select * from busca_job where id = $1 and organizacao_id = $2", [jobId, org]);
      if (!job || job.status !== "em_andamento") return;
      const etapa = async (texto: string): Promise<void> => {
        await db.query("update busca_job set etapa = $2, atualizado_em = now() where id = $1", [jobId, texto]);
      };
      try {
        await etapa("Consultando a empresa nas bases públicas");
        let empresa = await servicos.consultarEmpresa(job.cnpj as string);
        // Alvo só por site: tenta achar o CNPJ publicado no site para trazer o quadro societário (sócios).
        if ((job.cnpj as string).startsWith("site:") && empresa.socios.length === 0) {
          try {
            const r = await servicos.resolverSite((job.cnpj as string).slice(5));
            if (r.candidatos.length === 1) {
              const doCnpj = await servicos.consultarEmpresa(r.candidatos[0].cnpj);
              empresa = { ...empresa, socios: doCnpj.socios };
            }
          } catch {
            /* sem CNPJ no site: segue só com as fontes de site e web */
          }
        }
        const { contatos, doPool } = await coletar(empresa, job.cargos as string[], (p) =>
          etapa(`Consultando: ${p}`),
        );
        await etapa("Organizando os contatos");
        const ids = await concluirOuEstornar(job.cnpj as string, contatos, job.cobranca_id as string);
        await db.query(
          `update busca_job set status = 'concluida', etapa = $2, contato_ids = $3::uuid[], do_pool = $4,
             atualizado_em = now() where id = $1`,
          [jobId, ids.length ? "Pronto" : "Nenhum contato encontrado (crédito devolvido)", ids, doPool],
        );
      } catch (e) {
        await falharBusca(jobId, job.cobranca_id as string | null, e instanceof Error ? e.message : "Erro inesperado.");
      }
    },
    async statusBusca(jobId: string): Promise<EstadoBusca> {
      if (!UUID.test(jobId)) throw new ErroDeNegocio("Busca não encontrada.", 404);
      await varrerBuscasPerdidas();
      const j = await um<Linha>("select * from busca_job where id = $1 and organizacao_id = $2", [jobId, org]);
      if (!j) throw new ErroDeNegocio("Busca não encontrada.", 404);
      return estadoDoJob(j);
    },
    /** Busca mais recente desta organização para a empresa (últimas 24 h), para retomar a tela. */
    async ultimaBusca(cnpj: string): Promise<EstadoBusca | null> {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      await varrerBuscasPerdidas();
      const j = await um<Linha>(
        `select * from busca_job where organizacao_id = $1 and cnpj = $2 and criado_em > now() - interval '24 hours'
          order by criado_em desc limit 1`,
        [org, chaveAlvo(cnpj)],
      );
      return j ? estadoDoJob(j) : null;
    },
    /** Buscas recentes da organização (para retomar o trabalho). */
    async buscasRecentes(limite = 12) {
      const r = await db.query<Linha>(
        `select j.id, j.cnpj, j.status, j.criado_em, j.etapa, e.dados->>'razaoSocial' as nome
           from busca_job j left join empresa_cache e on e.cnpj = j.cnpj
          where j.organizacao_id = $1 order by j.criado_em desc limit $2`,
        [org, limite],
      );
      return r.rows.map((x) => ({
        id: x.id as string,
        cnpj: x.cnpj as string,
        empresa: (x.nome as string) ?? (x.cnpj as string),
        status: x.status as string,
        quando: new Date(x.criado_em as string).toISOString(),
      }));
    },
    async revelar(params: { contatoId: string; campo: "email" | "telefone" }) {
      if (!UUID.test(params.contatoId)) throw new ErroDeNegocio("Contato não encontrado.", 404);
      try {
        await db.query("select revelar_contato($1,$2)", [params.contatoId, params.campo]);
      } catch (e) {
        traduzir(e);
      }
      const [g] = await guardados([params.contatoId]);
      return { contato: visivel(g), saldo: await saldo() };
    },
  };
}
