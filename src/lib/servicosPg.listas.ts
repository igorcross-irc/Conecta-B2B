import { alvoValido, somenteDigitos } from "./cnpj";
import { lerCsv, normalizarCabecalho } from "./csv";
import { montarCsv, type FormatoExportacao, type LinhaExportacao } from "./exportacao";
import { ErroDeNegocio, visivel, type ContatoVisivel } from "./servicos";
import { Linha, ListaPg, UUID } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "listas". */
export function criarListas(c: Ctx) {
  const { db, org, ator, um, guardados, servicos } = c;
  return {
    async criarLista(nome: string): Promise<ListaPg> {
      const limpo = nome.trim();
      if (!limpo) throw new ErroDeNegocio("Dê um nome à lista.");
      const r = await um<{ id: string }>(
        "insert into lista (organizacao_id, nome) values ($1,$2) returning id",
        [org, limpo],
      );
      return { id: r!.id, nome: limpo, contatoIds: [] };
    },
    async listas(): Promise<ListaPg[]> {
      const ls = await db.query<Linha>("select id, nome from lista where organizacao_id = $1 order by criado_em, id", [org]);
      const out: ListaPg[] = [];
      for (const l of ls.rows) {
        const it = await db.query<{ contato_id: string }>(
          "select contato_id from lista_item where lista_id = $1 order by contato_id",
          [l.id],
        );
        out.push({ id: l.id as string, nome: l.nome as string, contatoIds: it.rows.map((x) => x.contato_id) });
      }
      return out;
    },
    async adicionarALista(listaId: string, contatoIds: string[]): Promise<ListaPg> {
      if (!UUID.test(listaId) || !(await um("select 1 from lista where id=$1 and organizacao_id=$2", [listaId, org])))
        throw new ErroDeNegocio("Lista não encontrada.", 404);
      if (contatoIds.some((id) => !UUID.test(id)) || (await guardados(contatoIds)).length !== new Set(contatoIds).size)
        throw new ErroDeNegocio("Contato não encontrado.", 404);
      for (const id of contatoIds) {
        await db.query("insert into lista_item (lista_id, contato_id) values ($1,$2) on conflict do nothing", [listaId, id]);
      }
      return (await servicos.listas()).find((l) => l.id === listaId)!;
    },
    async contatosDaLista(listaId: string): Promise<ContatoVisivel[]> {
      const l = (await servicos.listas()).find((x) => x.id === listaId);
      if (!l) throw new ErroDeNegocio("Lista não encontrada.", 404);
      return (await guardados(l.contatoIds)).map(visivel);
    },
    /** Exporta só o que já foi revelado; nada pago vaza no arquivo. */
    async exportarCsv(listaId: string, formato: FormatoExportacao = "padrao"): Promise<string> {
      const l = (await servicos.listas()).find((x) => x.id === listaId);
      if (!l) throw new ErroDeNegocio("Lista não encontrada.", 404);
      const gs = await guardados(l.contatoIds);
      const cnpjs = [...new Set(gs.map((g) => g.cnpj))];
      const empresas = cnpjs.length
        ? await db.query<Linha>(
            `select c.cnpj, c.dados->>'razaoSocial' as razao, c.dados->>'nomeFantasia' as fantasia,
                    coalesce(i.dominio, c.dados->>'dominio') as dominio
               from empresa_cache c left join base_empresa_info i on i.cnpj = c.cnpj where c.cnpj = any($1::text[])`,
            [cnpjs],
          )
        : { rows: [] as Linha[] };
      const porCnpj = new Map(empresas.rows.map((r) => [r.cnpj as string, r]));
      // Só o que já foi revelado sai no arquivo: o dado pago continua oculto.
      const linhas: LinhaExportacao[] = gs.map((g) => {
        const v = visivel(g);
        const e = porCnpj.get(g.cnpj);
        return {
          nome: v.nome, cargo: v.cargo, email: v.email, telefone: v.telefone, linkedin: v.linkedinUrl, origem: v.origem,
          empresa: (e?.fantasia as string) || (e?.razao as string) || undefined,
          cnpj: g.cnpj.startsWith("site:") ? undefined : g.cnpj,
          site: (e?.dominio as string) || (g.cnpj.startsWith("site:") ? g.cnpj.slice(5) : undefined),
        };
      });
      return montarCsv(formato, linhas);
    },
    /**
     * Importa contatos do próprio cliente por CSV. Colunas: cnpj, nome, cargo (obrigatórias);
     * email, telefone, linkedin (opcionais). Não cobra créditos: o dado é do próprio cliente,
     * então já entra revelado. Respeita o opt-out.
     */
    async importarContatos(texto: string, opcoes: { compartilhar?: boolean } = {}): Promise<{ importados: number; ignorados: number; erros: string[] }> {
      const linhas = lerCsv(texto);
      if (linhas.length < 2) throw new ErroDeNegocio("O arquivo precisa de cabeçalho e ao menos uma linha.");
      if (linhas.length > 5001) throw new ErroDeNegocio("Limite de 5.000 linhas por importação.");
      const idx = new Map(linhas[0].map((h, i) => [normalizarCabecalho(h), i]));
      const col = (...nomes: string[]) => nomes.map((n) => idx.get(n)).find((i) => i !== undefined);
      const iCnpj = col("cnpj");
      const iNome = col("nome", "contato");
      const iCargo = col("cargo");
      if (iCnpj === undefined || iNome === undefined || iCargo === undefined) {
        throw new ErroDeNegocio("Faltam colunas obrigatórias: cnpj, nome e cargo.");
      }
      const iEmail = col("email", "emailcorporativo");
      const iTel = col("telefone", "celular", "fone");
      const iLink = col("linkedin", "linkedinurl");
      const saiu = new Set(
        (await db.query<{ email: string }>("select email from opt_out")).rows.map((r) => r.email),
      );
      const erros: string[] = [];
      let importados = 0;
      let ignorados = 0;
      for (let n = 1; n < linhas.length; n++) {
        const l = linhas[n];
        const v = (i?: number) => (i === undefined ? "" : (l[i] ?? "").trim());
        const cnpj = somenteDigitos(v(iCnpj));
        if (!alvoValido(cnpj)) {
          erros.push(`Linha ${n + 1}: CNPJ inválido.`);
          continue;
        }
        if (!v(iNome) || !v(iCargo)) {
          erros.push(`Linha ${n + 1}: nome e cargo são obrigatórios.`);
          continue;
        }
        const email = v(iEmail).toLowerCase() || null;
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          erros.push(`Linha ${n + 1}: e-mail inválido.`);
          continue;
        }
        if (email && saiu.has(email)) {
          ignorados++;
          continue;
        }
        const tel = v(iTel) || null;
        const r = await um<{ id: string }>(
          `insert into contato (organizacao_id, cnpj, nome, cargo, linkedin_url, tem_email, tem_telefone,
             email_revelado, telefone_revelado, email_status, origem, obtido_em, confianca)
           values ($1,$2,$3,$4,$5,$6,$7,$6,$7,$8,'importação própria',now(),0.7)
           on conflict (organizacao_id, cnpj, nome, cargo) do update set nome = excluded.nome
           returning id`,
          [org, cnpj, v(iNome), v(iCargo), v(iLink) || null, Boolean(email), Boolean(tel), email ? "nao_verificado" : null],
        );
        await db.query(
          `insert into contato_dado (contato_id, email, telefone) values ($1,$2,$3)
           on conflict (contato_id) do update set email = coalesce(excluded.email, contato_dado.email),
             telefone = coalesce(excluded.telefone, contato_dado.telefone)`,
          [r!.id, email, tel],
        );
        if (opcoes.compartilhar) {
          // Só entra na base comum se o usuário marcou a opção; quem já está lá não é sobrescrito.
          await db.query(
            `insert into base_contato (cnpj, nome, cargo, email, telefone, linkedin_url, origem, contribuido_por, organizacao_id)
             values ($1,$2,$3,$4,$5,$6,'Importação de usuário',$7,$8)
             on conflict (cnpj, lower(nome), lower(cargo)) do nothing`,
            [cnpj, v(iNome), v(iCargo), email, tel, v(iLink) || null, ator.usuarioId, org],
          );
        }
        await db.query(
          `update contato set tem_email = tem_email or $2, tem_telefone = tem_telefone or $3,
             email_revelado = email_revelado or $2, telefone_revelado = telefone_revelado or $3 where id = $1`,
          [r!.id, Boolean(email), Boolean(tel)],
        );
        importados++;
      }
      return { importados, ignorados, erros: erros.slice(0, 50) };
    },
  };
}
