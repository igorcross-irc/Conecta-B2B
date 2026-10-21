import type { Db } from "@/db/conexao";
import { buscarEmCascata } from "./cascade";
import { TABELA_CUSTOS_PADRAO, type Lancamento, type TabelaCustos } from "./credits";
import { cnpjValido, somenteDigitos } from "./cnpj";
import { ORG_DEMO } from "@/db/local";
import type { Contato, Empresa, ProvedorContatos, ProvedorEmpresa } from "./providers/types";
import {
  celulaCsv,
  ErroDeNegocio,
  visivel,
  type ContatoGuardado,
  type ContatoVisivel,
} from "./servicos";

export interface ListaPg {
  id: string;
  nome: string;
  contatoIds: string[];
}

interface Dependencias {
  db: Db;
  empresa: ProvedorEmpresa;
  contatos: ProvedorContatos[];
  org?: string;
}

type Linha = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Converte erros das funções SQL em erros de negócio com o status certo. */
function traduzir(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/saldo insuficiente/.test(msg)) throw new ErroDeNegocio("Saldo de créditos insuficiente.", 402);
  if (/dado inexistente/.test(msg))
    throw new ErroDeNegocio("Este contato não tem esse dado. Nada foi cobrado.", 404);
  if (/sem acesso/.test(msg)) throw new ErroDeNegocio("Sem acesso a esta organização.", 403);
  if (/não encontrado/.test(msg)) throw new ErroDeNegocio("Contato não encontrado.", 404);
  throw e;
}

function paraGuardado(r: Linha): ContatoGuardado {
  const contato: Contato = {
    nome: r.nome as string,
    cargo: r.cargo as string,
    senioridade: (r.senioridade as string) ?? undefined,
    departamento: (r.departamento as string) ?? undefined,
    linkedinUrl: (r.linkedin_url as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    emailStatus: (r.email_status as Contato["emailStatus"]) ?? undefined,
    telefone: (r.telefone as string) ?? undefined,
    origem: r.origem as string,
    obtidoEm: new Date(r.obtido_em as string).toISOString(),
    confianca: Number(r.confianca),
  };
  return {
    id: r.id as string,
    cnpj: r.cnpj as string,
    contato,
    emailRevelado: r.email_revelado as boolean,
    telefoneRevelado: r.telefone_revelado as boolean,
  };
}

const SELECT_CONTATO = `
  select c.*, d.email, d.telefone
    from contato c left join contato_dado d on d.contato_id = c.id`;

/** Mesma interface do serviço em memória, mas persistida em Postgres (todas as chamadas são assíncronas). */
export function criarServicosPg({
  db,
  empresa: provedorEmpresa,
  contatos: provedores,
  org = ORG_DEMO,
}: Dependencias) {

  async function um<T extends Linha = Linha>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await db.query<T>(sql, params)).rows[0];
  }

  async function guardados(ids: string[]): Promise<ContatoGuardado[]> {
    if (ids.length === 0) return [];
    const r = await db.query<Linha>(`${SELECT_CONTATO} where c.organizacao_id = $1 and c.id = any($2::uuid[])`, [
      org,
      ids,
    ]);
    const porId = new Map(r.rows.map((x) => [x.id as string, paraGuardado(x)]));
    return ids.flatMap((id) => (porId.get(id) ? [porId.get(id)!] : []));
  }

  const saldo = async () =>
    Number((await um<{ s: number }>("select saldo_creditos($1) as s", [org]))!.s);

  async function cobrar(operacao: string, custo: number, descricao: string, chave: string) {
    try {
      return (await um<{ id: string }>("select (cobrar_creditos($1,$2,$3,$4,$5)).id as id", [
        org,
        operacao,
        custo,
        descricao,
        chave,
      ]))!;
    } catch (e) {
      return traduzir(e);
    }
  }

  const servicos = {
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

    async consultarEmpresa(cnpj: string): Promise<Empresa> {
      if (!cnpjValido(cnpj)) throw new ErroDeNegocio("CNPJ inválido.");
      const e = await provedorEmpresa.buscarPorCnpj(cnpj);
      if (!e) throw new ErroDeNegocio("Empresa não encontrada.", 404);
      await db.query(
        `insert into empresa_cache (cnpj, dados, fonte) values ($1, $2, $3)
         on conflict (cnpj) do update set dados = excluded.dados, fonte = excluded.fonte, obtido_em = now()`,
        [somenteDigitos(cnpj), JSON.stringify(e), e.fonte],
      );
      return e;
    },

    async buscarDecisores(params: { cnpj: string; cargos: string[]; chave: string }) {
      const empresa = await servicos.consultarEmpresa(params.cnpj);
      const cobranca = await cobrar(
        "busca_decisores",
        (await servicos.custos()).busca_decisores,
        `Busca de decisores: ${empresa.razaoSocial}`,
        `busca:${params.chave}`,
      );
      const cargos = params.cargos.map((c) => c.trim().toLowerCase()).filter(Boolean);
      const saiu = new Set(
        (await db.query<{ email: string }>("select email from opt_out")).rows.map((r) => r.email),
      );
      const { contatos, tentativas } = await buscarEmCascata(
        provedores,
        { empresa, cargos },
        { optOut: (c) => Boolean(c.email && saiu.has(c.email.toLowerCase())) },
      );
      if (contatos.length === 0) {
        try {
          await db.query("select estornar_creditos($1,$2,$3)", [org, cobranca.id, "nenhum decisor encontrado"]);
        } catch (e) {
          traduzir(e);
        }
      }
      const cnpj = somenteDigitos(params.cnpj);
      const ids: string[] = [];
      for (const c of contatos) {
        const r = await um<{ id: string }>(
          `insert into contato (organizacao_id, cnpj, nome, cargo, senioridade, departamento, linkedin_url,
             tem_email, tem_telefone, email_status, origem, obtido_em, confianca)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           on conflict (organizacao_id, cnpj, nome, cargo) do update set nome = excluded.nome
           returning id`,
          [
            org, cnpj, c.nome, c.cargo, c.senioridade ?? null, c.departamento ?? null, c.linkedinUrl ?? null,
            Boolean(c.email), Boolean(c.telefone), c.emailStatus ?? null, c.origem, c.obtidoEm, c.confianca,
          ],
        );
        await db.query(
          `insert into contato_dado (contato_id, email, telefone) values ($1,$2,$3)
           on conflict (contato_id) do update set email = coalesce(excluded.email, contato_dado.email),
             telefone = coalesce(excluded.telefone, contato_dado.telefone)`,
          [r!.id, c.email ?? null, c.telefone ?? null],
        );
        ids.push(r!.id);
      }
      return {
        contatos: (await guardados(ids)).map(visivel),
        tentativas,
        saldo: await saldo(),
      };
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
    async exportarCsv(listaId: string): Promise<string> {
      const linhas = (await servicos.contatosDaLista(listaId)).map((c) =>
        [c.nome, c.cargo, c.email, c.telefone, c.linkedinUrl, c.origem].map(celulaCsv).join(","),
      );
      return ["Nome,Cargo,E-mail,Telefone,LinkedIn,Origem", ...linhas].join("\n");
    },

    async registrarOptOut(email: string): Promise<void> {
      const e = email.trim().toLowerCase();
      if (!e.includes("@")) throw new ErroDeNegocio("E-mail inválido.");
      await db.query("insert into opt_out (email) values ($1) on conflict do nothing", [e]);
    },
  };
  return servicos;
}

export type ServicosPg = ReturnType<typeof criarServicosPg>;
