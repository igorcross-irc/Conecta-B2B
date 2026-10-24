import { alvoValido, chaveAlvo, normalizarBusca } from "./cnpj";
import { ErroDeNegocio } from "./erros";
import { visivel } from "./contatos";
import { EmpresaTrabalhada, EstadoBusca, Linha, UUID, VALIDADE_SQL, traduzir } from "./servicosPg.tipos";
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
    /**
     * Empresas em que a organização já trabalhou, consolidadas: pessoas colhidas, dados revelados, listas e buscas,
     * da mais recente para a mais antiga. Cada empresa aparece uma vez, venha o trabalho de busca, de revelação ou de lista.
     */
    async empresasTrabalhadas(f: { q?: string; limite?: number } = {}): Promise<EmpresaTrabalhada[]> {
      const limite = Math.min(500, Math.max(1, Math.floor(f.limite ?? 200)));
      const q = normalizarBusca(f.q ?? "");
      const r = await db.query<Linha>(
        `with pessoas as (
           select c.cnpj, count(*)::int as n, count(*) filter (where c.email_revelado)::int as emails,
                  count(*) filter (where c.telefone_revelado)::int as tels, max(c.obtido_em) as ultima
             from contato c where c.organizacao_id = $1 group by c.cnpj),
         listas as (
           select c.cnpj, count(distinct li.lista_id)::int as n
             from lista_item li join contato c on c.id = li.contato_id
            where c.organizacao_id = $1 group by c.cnpj),
         buscas as (
           select j.cnpj, count(*)::int as n, max(j.criado_em) as ultima,
                  (array_agg(j.status order by j.criado_em desc))[1] as status
             from busca_job j where j.organizacao_id = $1 group by j.cnpj),
         todas as (
           select cnpj from pessoas union select cnpj from buscas)
         select t.cnpj, coalesce(p.n, 0) as pessoas, coalesce(p.emails, 0) as emails, coalesce(p.tels, 0) as tels,
                coalesce(l.n, 0) as listas, coalesce(b.n, 0) as buscas, b.status,
                greatest(p.ultima, b.ultima) as atividade,
                e.dados->>'razaoSocial' as razao, e.dados->>'nomeFantasia' as fantasia, e.dados->>'municipio' as municipio,
                e.dados->>'uf' as uf, e.dados->>'porte' as porte, e.dados->'cnaePrincipal'->>'descricao' as atividade_desc
           from todas t
           left join pessoas p on p.cnpj = t.cnpj left join listas l on l.cnpj = t.cnpj left join buscas b on b.cnpj = t.cnpj
           left join empresa_cache e on e.cnpj = t.cnpj
          order by greatest(p.ultima, b.ultima) desc nulls last, t.cnpj`,
        [org],
      );
      const itens = r.rows.map((x): EmpresaTrabalhada => {
        const cnpj = String(x.cnpj);
        const fantasia = ((x.fantasia as string) ?? "").trim();
        return {
          cnpj,
          nome: fantasia || (x.razao as string) || (cnpj.startsWith("site:") ? cnpj.slice(5) : cnpj),
          razaoSocial: (x.razao as string) ?? undefined,
          municipio: (x.municipio as string) ?? undefined,
          uf: (x.uf as string) ?? undefined,
          porte: (x.porte as string) ?? undefined,
          atividade: (x.atividade_desc as string) ?? undefined,
          pessoas: Number(x.pessoas), emailsRevelados: Number(x.emails), telefonesRevelados: Number(x.tels),
          listas: Number(x.listas), buscas: Number(x.buscas),
          ultimaBusca: (x.status as EmpresaTrabalhada["ultimaBusca"]) ?? undefined,
          ultimaAtividade: new Date((x.atividade as string) ?? Date.now()).toISOString(),
        };
      });
      const filtradas = q
        ? itens.filter((i) => normalizarBusca(`${i.nome} ${i.razaoSocial ?? ""} ${i.municipio ?? ""} ${i.cnpj}`).includes(q))
        : itens;
      return filtradas.slice(0, limite);
    },
    /** Todas as pessoas que a organização já colheu para a empresa, de qualquer busca (com e-mail e telefone mascarados até revelar). */
    async contatosDaEmpresa(cnpj: string) {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const ids = (await db.query<Linha>("select id from contato where organizacao_id = $1 and cnpj = $2 order by obtido_em desc, nome", [org, chaveAlvo(cnpj)])).rows.map((x) => x.id as string);
      return (await guardados(ids)).map(visivel);
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
