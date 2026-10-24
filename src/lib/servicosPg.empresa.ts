import { alvoValido, chaveAlvo } from "./cnpj";
import { enriquecer as enriquecerEmpresa, type Enriquecimento } from "./enriquecimento";
import { dominioSeguro } from "./providers/site";
import { type Empresa, VERSAO_EMPRESA } from "./providers/types";
import { ErroDeNegocio } from "./servicos";
import { UUID } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "empresa". */
export function criarEmpresa(c: Ctx) {
  const { db, ator, provedorEmpresa, descobridor, registrar, auditar, um, guardados, empresaDaReceita, completarComReceita, servicos } = c;
  return {
    /**
     * Empresa pelo CNPJ. Reaproveita a base compartilhada (empresa_cache, 90 dias) antes de chamar as APIs
     * públicas, e aplica por cima o que a comunidade corrigiu (site da empresa).
     */
    async consultarEmpresa(cnpj: string): Promise<Empresa> {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const digitos = chaveAlvo(cnpj);
      const ehSite = digitos.startsWith("site:");
      const guardada = await um<{ dados: Empresa }>(
        "select dados from empresa_cache where cnpj = $1 and obtido_em > now() - interval '90 days'",
        [digitos],
      );
      let e = guardada?.dados;
      // Fichas guardadas antes do formato novo (sem endereço, sócios com data etc.) são consultadas de novo.
      const desatualizada = !!e && !ehSite && (e.versao ?? 1) < VERSAO_EMPRESA;
      const antiga = desatualizada ? e : undefined;
      if (desatualizada) e = undefined;
      if (!e && ehSite) {
        // Alvo por site, sem CNPJ: a empresa é o próprio endereço e as fontes de contato rodam sobre ele.
        const dom = digitos.slice(5);
        e = {
          cnpj: digitos, razaoSocial: dom, nomeFantasia: dom, situacao: "Pesquisa por site (sem CNPJ)",
          telefones: [], emailsCadastrais: [], dominio: dom, socios: [], fonte: "Site informado",
          obtidoEm: new Date().toISOString(), versao: VERSAO_EMPRESA,
        };
        await db.query(
          `insert into empresa_cache (cnpj, dados, fonte) values ($1, $2, $3)
           on conflict (cnpj) do update set dados = excluded.dados, fonte = excluded.fonte, obtido_em = now()`,
          [digitos, JSON.stringify(e), e.fonte],
        );
      }
      if (!e) {
        let nova: Empresa | null = null;
        try {
          nova = await provedorEmpresa.buscarPorCnpj(cnpj);
        } catch (erro) {
          // Fonte externa indisponível ou no limite: usa a ficha antiga ou a base da Receita já importada.
          nova = antiga ?? (await empresaDaReceita(digitos));
          if (!nova) throw erro;
        }
        if (!nova) nova = await empresaDaReceita(digitos);
        if (!nova) throw new ErroDeNegocio("Empresa não encontrada.", 404);
        await db.query(
          `insert into empresa_cache (cnpj, dados, fonte) values ($1, $2, $3)
           on conflict (cnpj) do update set dados = excluded.dados, fonte = excluded.fonte, obtido_em = now()`,
          [digitos, JSON.stringify(nova), nova.fonte],
        );
        e = nova;
      }
      if (!ehSite) e = await completarComReceita(e);
      const info = await um<{ dominio: string | null }>("select dominio from base_empresa_info where cnpj = $1", [digitos]);
      return info?.dominio ? { ...e, dominio: info.dominio } : e;
    },
    /**
     * Empresa pelo endereço do site. Primeiro a base comum (sites já associados a um CNPJ);
     * depois lê o próprio site atrás de um CNPJ publicado. Devolve candidatos para a pessoa confirmar.
     */
    async resolverSite(entrada: string) {
      const dominio = dominioSeguro(entrada)?.replace(/^www\./, "");
      if (!dominio) throw new ErroDeNegocio("Site inválido. Use algo como empresa.com.br.");
      const conhecidos = await db.query<{ cnpj: string }>(
        `select cnpj from base_empresa_info where dominio in ($1, 'www.' || $1)
         union select cnpj from empresa_cache where dados->>'dominio' in ($1, 'www.' || $1)`,
        [dominio],
      );
      let cnpjs = conhecidos.rows.map((r) => r.cnpj);
      let origem: "base" | "site" = "base";
      if (cnpjs.length === 0) {
        if (!descobridor) throw new ErroDeNegocio("A busca por site não está disponível neste ambiente. Informe o CNPJ.");
        origem = "site";
        cnpjs = (await descobridor(dominio)).map((x) => x.cnpj);
      }
      const candidatos: { cnpj: string; razaoSocial: string; nomeFantasia?: string; municipio?: string; uf?: string; situacao?: string }[] = [];
      for (const cnpj of cnpjs.slice(0, 4)) {
        try {
          const e = await servicos.consultarEmpresa(cnpj);
          candidatos.push({ cnpj: e.cnpj, razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia, municipio: e.municipio, uf: e.uf, situacao: e.situacao });
        } catch {
          /* CNPJ citado no site que a Receita não conhece: ignora */
        }
      }
      if (candidatos.length === 0)
        throw new ErroDeNegocio("Não encontrei um CNPJ publicado nesse site. Informe o CNPJ da empresa.", 404);
      return { dominio, origem, candidatos };
    },
    /** Guarda na base comum que este site pertence a este CNPJ, sem sobrescrever o que a comunidade já corrigiu. */
    async associarSite(cnpj: string, site: string) {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const dominio = dominioSeguro(site)?.replace(/^www\./, "");
      if (!dominio) return;
      const d = chaveAlvo(cnpj);
      const antes = await um<{ dominio: string | null }>("select dominio from base_empresa_info where cnpj = $1", [d]);
      if (antes?.dominio) return;
      await db.query(
        `insert into base_empresa_info (cnpj, dominio, atualizado_por) values ($1,$2,$3)
         on conflict (cnpj) do update set dominio = coalesce(base_empresa_info.dominio, excluded.dominio),
           atualizado_por = excluded.atualizado_por, atualizado_em = now()`,
        [d, dominio, ator.usuarioId],
      );
      await db.query("delete from pool_busca where cnpj = $1", [d]);
      await auditar("base.empresa", d, { dominio });
    },
    /** Informações extras da empresa (CVM, Wikidata, notícias, sanções), cada fonte com cache e falha próprias. */
    async enriquecer(cnpj: string): Promise<Enriquecimento> {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ ou site inválido.");
      const e = await servicos.consultarEmpresa(cnpj);
      // Modo demonstração promete funcionar sem internet: não consulta as fontes externas.
      if (process.env.CONECTA_MODO_DEMO === "1") return { erros: {}, obtidoEm: new Date().toISOString() };
      return enriquecerEmpresa(db, { cnpj: chaveAlvo(cnpj), razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia, dominio: e.dominio }, { registrar });
    },
    /** Dados que a mensagem de abordagem usa: nome e cargo da pessoa e fatos públicos da empresa (nada de e-mail ou telefone). */
    async dadosParaAbordagem(contatoId: string) {
      if (!UUID.test(contatoId)) throw new ErroDeNegocio("Contato não encontrado.", 404);
      const [c] = await guardados([contatoId]);
      if (!c) throw new ErroDeNegocio("Contato não encontrado.", 404);
      const e = await servicos.consultarEmpresa(c.cnpj);
      const idadeAnos = e.abertaEm ? Math.max(0, Math.floor((Date.now() - Date.parse(e.abertaEm)) / 31_557_600_000)) : undefined;
      return {
        contato: { nome: c.contato.nome, cargo: c.contato.cargo },
        empresa: {
          razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia, segmento: e.cnaePrincipal?.descricao,
          municipio: e.municipio, uf: e.uf, idadeAnos,
        },
      };
    },
  };
}
