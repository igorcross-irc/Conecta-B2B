import { alvoValido, chaveAlvo } from "./cnpj";
import { dominioSeguro } from "./providers/site";
import type { Contato, Empresa } from "./providers/types";
import { ErroDeNegocio } from "./servicos";
import { ItemBase, Linha, VALIDADE_SQL } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "baseComum". */
export function criarBaseComum(c: Ctx) {
  const { db, org, ator, auditar, um, servicos } = c;
  return {
    /** Empresas já pesquisadas por qualquer usuário, com o que se sabe delas. Só dados públicos e contagens. */
    async listarBase(f: { q?: string; uf?: string; pagina?: number } = {}): Promise<{ itens: ItemBase[]; total: number }> {
      const q = (f.q ?? "").trim();
      const uf = (f.uf ?? "").trim().toUpperCase();
      const pagina = Math.max(0, Math.floor(f.pagina ?? 0));
      const digitos = q.replace(/\D/g, "");
      const filtro = `
        ($1 = '' or e.dados->>'razaoSocial' ilike '%' || $1 || '%' or e.dados->>'nomeFantasia' ilike '%' || $1 || '%'
           or e.dados->'cnaePrincipal'->>'descricao' ilike '%' || $1 || '%'
           or e.dados->>'municipio' ilike '%' || $1 || '%'
           or ($2 <> '' and e.cnpj like $2 || '%'))
        and ($3 = '' or e.dados->>'uf' = $3)`;
      const total = await um<{ n: number }>(`select count(*)::int as n from empresa_cache e where ${filtro}`, [q, digitos, uf]);
      const r = await db.query<Linha>(
        `select e.cnpj, e.dados, e.obtido_em, i.dominio, i.tags, i.atualizado_em,
                coalesce((select max(jsonb_array_length(p.contatos)) from pool_busca p where p.cnpj = e.cnpj), 0)::int as no_pool,
                (select count(*)::int from base_contato b where b.cnpj = e.cnpj) as da_comunidade
           from empresa_cache e left join base_empresa_info i on i.cnpj = e.cnpj
          where ${filtro} order by e.obtido_em desc limit 24 offset $4`,
        [q, digitos, uf, pagina * 24],
      );
      return {
        total: total?.n ?? 0,
        itens: r.rows.map((x) => {
          const d = x.dados as Empresa;
          return {
            cnpj: x.cnpj as string,
            razaoSocial: d.razaoSocial,
            nomeFantasia: d.nomeFantasia,
            municipio: d.municipio,
            uf: d.uf,
            atividade: d.cnaePrincipal?.descricao,
            dominio: (x.dominio as string) ?? d.dominio,
            noPool: Number(x.no_pool),
            daComunidade: Number(x.da_comunidade),
            tags: (x.tags as string[]) ?? [],
            atualizadoEm: new Date((x.atualizado_em as string) ?? (x.obtido_em as string)).toISOString(),
          };
        }),
      };
    },
    /** Ficha da empresa na base: dados públicos, nota e tags da comunidade e a prévia grátis dos cargos disponíveis. */
    async fichaBase(cnpj: string) {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const empresa = await servicos.consultarEmpresa(cnpj);
      const d = chaveAlvo(cnpj);
      const info = await um<Linha>("select nota, tags, atualizado_em from base_empresa_info where cnpj = $1", [d]);
      const pool = await db.query<{ contatos: Contato[] }>(
        `select contatos from pool_busca where cnpj = $1 and obtido_em > now() - (${VALIDADE_SQL})`,
        [d],
      );
      const com = await db.query<Linha>("select cargo, senioridade from base_contato where cnpj = $1", [d]);
      const cargos = new Map<string, number>();
      for (const c of pool.rows.flatMap((x) => x.contatos))
        cargos.set(c.cargo, (cargos.get(c.cargo) ?? 0) + 1);
      for (const c of com.rows) cargos.set(c.cargo as string, (cargos.get(c.cargo as string) ?? 0) + 1);
      return {
        empresa,
        nota: (info?.nota as string) ?? undefined,
        tags: (info?.tags as string[]) ?? [],
        cargosDisponiveis: [...cargos].map(([cargo, quantidade]) => ({ cargo, quantidade })),
        disponiveis: await servicos.disponiveisNoPool(d),
      };
    },
    /** Qualquer membro pode corrigir site, nota e tags da empresa; vale para todos e fica na auditoria. */
    async atualizarInfoEmpresa(p: { cnpj: string; dominio?: string; nota?: string; tags?: string[] }) {
      if (!alvoValido(p.cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const d = chaveAlvo(p.cnpj);
      let dominio: string | null = null;
      if (p.dominio?.trim()) {
        dominio = dominioSeguro(p.dominio);
        if (!dominio) throw new ErroDeNegocio("Site inválido. Use algo como empresa.com.br.");
      }
      const tags = [...new Set((p.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
      const nota = (p.nota ?? "").trim().slice(0, 500) || null;
      const antes = await um<{ dominio: string | null }>("select dominio from base_empresa_info where cnpj = $1", [d]);
      await db.query(
        `insert into base_empresa_info (cnpj, dominio, nota, tags, atualizado_por) values ($1,$2,$3,$4,$5)
         on conflict (cnpj) do update set dominio = excluded.dominio, nota = excluded.nota, tags = excluded.tags,
           atualizado_por = excluded.atualizado_por, atualizado_em = now()`,
        [d, dominio, nota, tags, ator.usuarioId],
      );
      // Mudou o site: as varreduras guardadas usaram o site antigo, então são descartadas.
      if ((antes?.dominio ?? null) !== dominio) await db.query("delete from pool_busca where cnpj = $1", [d]);
      await auditar("base.empresa", d, { dominio, nota, tags });
    },
    /** Contribui com um contato para a base comum (visível a todos como resultado de busca, mediante crédito). */
    async contribuirContato(p: {
      cnpj: string; nome: string; cargo: string; email?: string; telefone?: string; linkedinUrl?: string;
    }) {
      if (!alvoValido(p.cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const nome = p.nome.trim();
      const cargo = p.cargo.trim();
      if (!nome || !cargo) throw new ErroDeNegocio("Informe nome e cargo.");
      const email = p.email?.trim().toLowerCase() || null;
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroDeNegocio("E-mail inválido.");
      if (email && (await um("select 1 from opt_out where email = $1", [email])))
        throw new ErroDeNegocio("Este e-mail pediu para não ser contatado e não pode ser adicionado.", 409);
      const linkedin = p.linkedinUrl?.trim() || null;
      if (linkedin && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|company)\//i.test(linkedin))
        throw new ErroDeNegocio("Use o endereço público do perfil no LinkedIn (https://www.linkedin.com/in/...).");
      const d = chaveAlvo(p.cnpj);
      await db.query(
        `insert into base_contato (cnpj, nome, cargo, email, telefone, linkedin_url, contribuido_por, organizacao_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (cnpj, lower(nome), lower(cargo)) do update set
           email = coalesce(excluded.email, base_contato.email),
           telefone = coalesce(excluded.telefone, base_contato.telefone),
           linkedin_url = coalesce(excluded.linkedin_url, base_contato.linkedin_url)`,
        [d, nome, cargo, email, p.telefone?.trim() || null, linkedin, ator.usuarioId, org],
      );
      await auditar("base.contato", d, { nome, cargo });
    },
  };
}
