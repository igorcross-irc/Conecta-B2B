import { normalizarBusca } from "./cnpj";
import { limparFiltros, paraParametros, resumoFiltros, type FiltrosUrl } from "./filtrosUrl";
import { ABERTURAS, PORTES, faixasDeSetores } from "./setores";
import { ErroDeNegocio } from "./servicos";
import { Linha, PesquisaFiltros, PesquisaSalva, ResultadoPesquisa, UUID } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "pesquisa". */
export function criarPesquisa(c: Ctx) {
  const { db, org, ator, auditar, um, temBaseReceita, servicos } = c;
  return {
    /**
     * Pesquisa empresas por nome/termos, UF, cidade, bairro e segmento (CNAE), na base da Receita importada
     * e nas empresas/sites já conhecidos. A resposta lista CNPJs e sites que combinam com o termo.
     */
    async pesquisar(f: PesquisaFiltros = {}): Promise<ResultadoPesquisa> {
      const nome = normalizarBusca(f.nome ?? "");
      const termos = normalizarBusca(f.termos ?? "").split(" ").filter(Boolean).slice(0, 5);
      const uf = (f.uf ?? "").trim().toUpperCase().slice(0, 2);
      const cidade = normalizarBusca(f.cidade ?? "");
      const bairro = normalizarBusca(f.bairro ?? "");
      const segmento = normalizarBusca(f.segmento ?? "");
      const todasMatrizes = f.incluirFiliais === true;
      const pagina = Math.max(0, Math.floor(f.pagina ?? 0));
      const setores = (f.setores ?? []).filter(Boolean);
      const portes = (f.porte ?? []).filter((x) => (PORTES as readonly string[]).includes(x));
      const abertura = ABERTURAS.find((a) => a.id === f.abertura);
      const abertaDesde = /^\d{4}-\d{2}-\d{2}$/.test(f.abertaDesde ?? "") ? f.abertaDesde : undefined;
      const temFiltro = abertaDesde || nome || termos.length || uf || cidade || bairro || segmento || setores.length || portes.length || abertura || f.comEmail || f.comTelefone;
      if (!temFiltro) return { itens: [], total: 0, baseReceita: await temBaseReceita(), sites: [] };

      const where: string[] = ["e.situacao = 'ATIVA'"];
      const p: unknown[] = [];
      const add = (v: unknown) => (p.push(v), `$${p.length}`);
      if (!todasMatrizes) where.push("e.matriz");
      if (nome) where.push(`e.busca like '%' || ${add(nome)} || '%'`);
      for (const t of termos) where.push(`e.busca like '%' || ${add(t)} || '%'`);
      if (uf) where.push(`e.uf = ${add(uf)}`);
      if (cidade) where.push(`lower(translate(e.municipio, 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) like '%' || ${add(cidade)} || '%'`);
      if (bairro) where.push(`lower(translate(e.bairro, 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) like '%' || ${add(bairro)} || '%'`);
      if (segmento) {
        const codigo = segmento.replace(/\D/g, "");
        where.push(
          codigo.length >= 4
            ? `e.cnae::text like ${add(codigo + "%")}`
            : `e.cnae in (select codigo from rf_cnae where busca like '%' || ${add(segmento)} || '%')`,
        );
      }
      const faixas = faixasDeSetores(setores);
      if (setores.length) {
        where.push(`(${faixas.map(([a, b]) => `e.cnae between ${a} and ${b}`).join(" or ") || "false"})`);
      }
      if (portes.length) where.push(`e.porte = any(${add(portes)}::text[])`);
      if (abertaDesde) where.push(`e.aberta_em >= ${add(abertaDesde)}::date`);
      if (abertura) {
        where.push(`e.aberta_em <= current_date - make_interval(years => ${Math.floor(abertura.deAnos)})`);
        if (abertura.ateAnos < 100) where.push(`e.aberta_em > current_date - make_interval(years => ${Math.floor(abertura.ateAnos)})`);
      }
      if (f.comEmail) where.push("e.email is not null");
      if (f.comTelefone) where.push("e.telefone is not null");
      const w = where.join(" and ");
      // Uma só varredura: a contagem vem junto da página (count(*) over ()), em vez de duas consultas.
      const r = await db.query(
        `select count(*) over ()::int as total_geral, e.cnpj, e.razao_social, e.nome_fantasia, e.municipio, e.uf, e.bairro, e.cnae, c.descricao as atividade,
                e.porte, e.aberta_em, e.matriz, (e.email is not null) as tem_email, (e.telefone is not null) as tem_telefone,
                (select i.dominio from base_empresa_info i where i.cnpj = e.cnpj) as dominio
           from rf_estabelecimento e left join rf_cnae c on c.codigo = e.cnae
          where ${w} order by ${f.ordem === "recentes" ? "e.aberta_em desc nulls last, e.razao_social" : "e.razao_social"} limit 25 offset ${add(pagina * 25)}`,
        p,
      );
      let totalGeral = r.rows.length ? Number(r.rows[0].total_geral) : 0;
      // Página além do fim: a contagem não veio junto, então conta à parte.
      if (!r.rows.length && pagina > 0) {
        totalGeral = (await um<{ n: number }>(`select count(*)::int as n from rf_estabelecimento e where ${w}`, p.slice(0, -1)))?.n ?? 0;
      }
      // Sites já conhecidos cujo endereço combina com o termo (não dependem da base da Receita)
      const termoSite = [nome, ...termos].filter(Boolean).join("").replace(/ /g, "");
      const sites = termoSite.length >= 3
        ? (await db.query(
            `select distinct dominio from (
               select dominio from base_empresa_info where dominio is not null
               union select substring(cnpj from 6) as dominio from empresa_cache where cnpj like 'site:%'
             ) s where replace(dominio, '-', '') like '%' || $1 || '%' order by dominio limit 10`,
            [termoSite],
          )).rows.map((x) => String(x.dominio))
        : [];
      return {
        total: totalGeral,
        baseReceita: await temBaseReceita(),
        sites,
        itens: r.rows.map((x) => ({
          cnpj: String(x.cnpj),
          razaoSocial: String(x.razao_social),
          nomeFantasia: (x.nome_fantasia as string) ?? undefined,
          municipio: (x.municipio as string) ?? undefined,
          uf: (x.uf as string) ?? undefined,
          bairro: (x.bairro as string) ?? undefined,
          atividade: (x.atividade as string) ?? undefined,
          dominio: (x.dominio as string) ?? undefined,
          porte: (x.porte as string) ?? undefined,
          abertaEm: x.aberta_em ? new Date(x.aberta_em as string).toISOString().slice(0, 10) : undefined,
          temEmail: x.tem_email === true,
          temTelefone: x.tem_telefone === true,
          matriz: x.matriz === true,
        })),
      };
    },
    /** UFs que existem na base da Receita carregada e quantas empresas cada uma tem (a base não cobre o Brasil inteiro). */
    async cobertura(): Promise<{ uf: string; empresas: number }[]> {
      const r = await db.query<Linha>("select uf, sum(qtd)::bigint as n from rf_municipio group by uf order by uf");
      return r.rows.map((x) => ({ uf: x.uf as string, empresas: Number(x.n) }));
    },
    /** Sugestões ao digitar na pesquisa: cidades (da lista de municípios da base) e atividades (CNAE). */
    async sugerir(campo: "cidade" | "segmento", q: string, uf?: string): Promise<{ valor: string; detalhe?: string }[]> {
      const t = normalizarBusca(q);
      if (t.length < 2) return [];
      if (campo === "cidade") {
        const u = (uf ?? "").trim().toUpperCase().slice(0, 2);
        const r = await db.query<Linha>(
          `select nome, uf, qtd from rf_municipio where nome_busca like $1 || '%' ${u ? "and uf = $2" : ""}
            order by qtd desc limit 8`,
          u ? [t, u] : [t],
        );
        return r.rows.map((x) => ({ valor: x.nome as string, detalhe: `${x.uf as string} · ${Number(x.qtd).toLocaleString("pt-BR")} empresas` }));
      }
      const digitos = t.replace(/\D/g, "");
      const r = await db.query<Linha>(
        digitos.length >= 3
          ? "select codigo, descricao from rf_cnae where codigo::text like $1 || '%' order by codigo limit 8"
          : "select codigo, descricao from rf_cnae where busca like '%' || $1 || '%' order by codigo limit 8",
        [digitos.length >= 3 ? digitos : t],
      );
      return r.rows.map((x) => ({ valor: x.descricao as string, detalhe: `CNAE ${x.codigo as number}` }));
    },
    async pesquisasSalvas(): Promise<PesquisaSalva[]> {
      const r = await db.query<Linha>(
        "select id, nome, filtros, avisar, ultimo_aviso, criado_em from pesquisa_salva where organizacao_id = $1 order by criado_em desc limit 100",
        [org],
      );
      return r.rows.map((x) => ({
        id: x.id as string, nome: x.nome as string, filtros: limparFiltros(x.filtros), avisar: x.avisar === true,
        ultimoAviso: new Date(x.ultimo_aviso as string).toISOString().slice(0, 10), criadoEm: new Date(x.criado_em as string).toISOString(),
      }));
    },
    async salvarPesquisa(nome: string, filtros: FiltrosUrl, avisar = true): Promise<string> {
      const n = nome.trim();
      if (!n || n.length > 80) throw new ErroDeNegocio("Dê um nome de até 80 caracteres à pesquisa.");
      const f = limparFiltros(filtros);
      if (!Object.keys(f).length) throw new ErroDeNegocio("Escolha ao menos um filtro antes de salvar.");
      const total = (await um<{ n: number }>("select count(*)::int as n from pesquisa_salva where organizacao_id = $1", [org]))?.n ?? 0;
      if (total >= 50) throw new ErroDeNegocio("Limite de 50 pesquisas salvas por organização.");
      const r = await um<{ id: string }>(
        "insert into pesquisa_salva (organizacao_id, criado_por, nome, filtros, avisar) values ($1,$2,$3,$4::jsonb,$5) returning id",
        [org, ator.usuarioId, n, JSON.stringify(f), avisar],
      );
      await auditar("pesquisa.salvar", r!.id, { nome: n });
      return r!.id;
    },
    async removerPesquisa(id: string): Promise<void> {
      if (!UUID.test(id)) throw new ErroDeNegocio("Pesquisa não encontrada.", 404);
      await db.query("delete from pesquisa_salva where id = $1 and organizacao_id = $2", [id, org]);
    },
    /**
     * Avisa por e-mail sobre empresas abertas desde o último aviso, para cada pesquisa salva com aviso ligado.
     * Roda diariamente (cron). Só marca o aviso como feito depois que o e-mail sai, então falha de envio tenta de novo.
     * Depende de a base da Receita ser atualizada: sem importação nova, não há empresa nova para avisar.
     */
    async rodarAlertas(
      enviar: (m: { para: string; assunto: string; texto: string }) => Promise<void>,
      urlBase: string,
    ): Promise<{ avaliadas: number; enviadas: number; falhas: number }> {
      const pend = await db.query<Linha>("select * from alertas_pendentes()");
      let enviadas = 0;
      let falhas = 0;
      for (const p of pend.rows) {
        try {
          const f = limparFiltros(p.filtros);
          const desde = new Date(p.ultimo_aviso as string).toISOString().slice(0, 10);
          const r = await servicos.pesquisar({ ...f, abertaDesde: desde, ordem: "recentes" });
          if (r.total > 0) {
            const linhas = r.itens.slice(0, 10).map((i) => `- ${i.nomeFantasia || i.razaoSocial} (${[i.municipio, i.uf].filter(Boolean).join("/")}) ${urlBase}/descobrir?alvo=${i.cnpj}`);
            await enviar({
              para: String(p.email),
              assunto: `${r.total} empresa(s) nova(s) em "${p.nome}"`,
              texto:
                `Desde ${desde}, ${r.total} empresa(s) abertas combinam com a sua pesquisa salva "${p.nome}" (${resumoFiltros(f)}).\n\n` +
                `${linhas.join("\n")}\n\nVer todas: ${urlBase}/pesquisar?${paraParametros({ ...f, ordem: "recentes" })}\n\n` +
                "Para parar de receber este aviso, desligue-o em Pesquisar > Pesquisas salvas.",
            });
            enviadas++;
          }
          await db.query("select alerta_registrar($1)", [p.id]);
        } catch (e) {
          falhas++;
          console.error("alerta: falha na pesquisa", p.id, e instanceof Error ? e.message : e);
        }
      }
      return { avaliadas: pend.rows.length, enviadas, falhas };
    },
  };
}
