import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/db/conexao";
import { buscarEmCascata, type Tentativa } from "./cascade";
import { TABELA_CUSTOS_PADRAO, type Lancamento, type TabelaCustos } from "./credits";
import { alvoValido, chaveAlvo, normalizarBusca, somenteDigitos } from "./cnpj";
import { lerCsv, normalizarCabecalho } from "./csv";
import { ORG_DEMO, USUARIO_DEMO } from "@/db/local";
import { dominioSeguro } from "./providers/site";
import type { Contato, Empresa, ProvedorContatos, ProvedorEmpresa } from "./providers/types";
import { VERSAO_EMPRESA } from "./providers/types";
import { ABERTURAS, PORTES, faixasDeSetores } from "./setores";
import {
  celulaCsv,
  ErroDeNegocio,
  visivel,
  type ContatoGuardado,
  type ContatoVisivel,
} from "./servicos";

export interface PesquisaFiltros {
  nome?: string; termos?: string; uf?: string; cidade?: string; bairro?: string; segmento?: string;
  /** ids de macro-setores (ver setores.ts). */
  setores?: string[];
  porte?: string[];
  /** id de faixa de tempo de abertura (ver ABERTURAS). */
  abertura?: string;
  comEmail?: boolean;
  comTelefone?: boolean;
  ordem?: "nome" | "recentes";
  incluirFiliais?: boolean; pagina?: number;
}
export interface ItemPesquisa {
  cnpj: string; razaoSocial: string; nomeFantasia?: string; municipio?: string; uf?: string;
  bairro?: string; atividade?: string; dominio?: string;
  porte?: string; abertaEm?: string; temEmail: boolean; temTelefone: boolean; matriz: boolean;
}
export interface ResultadoPesquisa { itens: ItemPesquisa[]; total: number; baseReceita: boolean; sites: string[] }

export interface EstadoBusca {
  id: string;
  cnpj: string;
  status: "em_andamento" | "concluida" | "erro";
  etapa: string;
  /** Verdadeiro quando o resultado veio de uma varredura anterior (pool), sem consultar as fontes de novo. */
  doPool: boolean;
  erro?: string;
  contatos?: ContatoVisivel[];
  saldo?: number;
}

/** Validade do resultado no pool: 90 dias quando achou alguém, 1 dia quando não achou nada. */
const VALIDADE_SQL = "case when jsonb_array_length(contatos) > 0 then interval '90 days' else interval '1 day' end";
/** Uma busca sem sinal de vida por tanto tempo é considerada perdida (servidor reiniciou ou excedeu o prazo). */
const TEMPO_MAXIMO_BUSCA_MIN = 5;

export interface ListaPg {
  id: string;
  nome: string;
  contatoIds: string[];
}

/** Quem está agindo: define o que pode fazer (administrador da organização, operadora da plataforma). */
export interface Ator {
  usuarioId: string;
  papel: "administrador" | "membro";
  operadora: boolean;
}

export interface Membro {
  usuarioId: string;
  nome?: string;
  email?: string;
  papel: "administrador" | "membro";
}

export interface ConvitePendente {
  id: string;
  email: string;
  papel: "administrador" | "membro";
  criadoEm: string;
  expiraEm: string;
}

export interface ItemBase {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  municipio?: string;
  uf?: string;
  atividade?: string;
  dominio?: string;
  noPool: number;
  daComunidade: number;
  tags: string[];
  atualizadoEm: string;
}

interface Dependencias {
  db: Db;
  ator?: Ator;
  empresa: ProvedorEmpresa;
  contatos: ProvedorContatos[];
  /** Acha CNPJs publicados num site (para buscar a empresa pelo endereço do site). */
  descobridor?: (dominio: string) => Promise<{ cnpj: string; ocorrencias: number }[]>;
  org?: string;
}

type Linha = Record<string, unknown>;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Converte erros das funções SQL em erros de negócio com o status certo. */
function traduzir(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/saldo insuficiente/.test(msg)) throw new ErroDeNegocio("Saldo de créditos insuficiente.", 402);
  if (/dado inexistente/.test(msg))
    throw new ErroDeNegocio("Este contato não tem esse dado. Nada foi cobrado.", 404);
  if (/sem acesso/.test(msg)) throw new ErroDeNegocio("Sem acesso a esta organização.", 403);
  if (/não encontrado/.test(msg)) throw new ErroDeNegocio("Contato não encontrado.", 404);
  if (/convite inválido/.test(msg)) throw new ErroDeNegocio("Convite inválido ou expirado.", 404);
  if (/ao menos um administrador/.test(msg))
    throw new ErroDeNegocio("A organização precisa de ao menos um administrador.", 409);
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
  descobridor,
  org = ORG_DEMO,
  ator = { usuarioId: USUARIO_DEMO, papel: "administrador", operadora: true },
}: Dependencias) {
  const exigirAdmin = () => {
    if (ator.papel !== "administrador") throw new ErroDeNegocio("Apenas administradores podem fazer isso.", 403);
  };
  const exigirOperadora = () => {
    if (!ator.operadora) throw new ErroDeNegocio("Apenas a operadora da plataforma pode fazer isso.", 403);
  };
  const auditar = (acao: string, alvo: string | null, detalhe: Record<string, unknown> = {}) =>
    db.query("insert into auditoria (usuario_id, organizacao_id, acao, alvo, detalhe) values ($1,$2,$3,$4,$5::jsonb)", [
      ator.usuarioId, org, acao, alvo, JSON.stringify(detalhe),
    ]);

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

  const temBaseReceita = async () =>
    ((await db.query<{ n: number }>("select count(*)::int as n from (select 1 from rf_estabelecimento limit 1) x")).rows[0]?.n ?? 0) > 0;
  /** Linha da base da Receita importada (rf_estabelecimento), se existir. */
  const linhaReceita = (cnpj: string) =>
    um<Record<string, unknown>>(
      `select e.*, c.descricao as cnae_descricao from rf_estabelecimento e left join rf_cnae c on c.codigo = e.cnae where e.cnpj = $1`,
      [cnpj],
    );
  const telefoneBr = (v: unknown) => {
    const d = String(v ?? "").replace(/\D/g, "");
    return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : null;
  };
  const empresaDaReceita = async (cnpj: string): Promise<Empresa | null> => {
    const r = await linhaReceita(cnpj);
    if (!r) return null;
    return completarComReceita({
      cnpj, razaoSocial: String(r.razao_social), nomeFantasia: (r.nome_fantasia as string) ?? undefined, situacao: "Ativa",
      telefones: [], emailsCadastrais: [], socios: [], fonte: "Receita Federal (base importada)", obtidoEm: new Date().toISOString(),
      versao: VERSAO_EMPRESA,
    });
  };
  /** Preenche o que a fonte externa não trouxe com os dados da base da Receita já importada. */
  const completarComReceita = async (e: Empresa): Promise<Empresa> => {
    const r = await linhaReceita(e.cnpj);
    if (!r) return e;
    const tel = telefoneBr(r.telefone);
    const mail = r.email ? String(r.email).toLowerCase() : null;
    return {
      ...e,
      municipio: e.municipio ?? ((r.municipio as string) || undefined),
      uf: e.uf ?? ((r.uf as string) || undefined),
      porte: e.porte ?? ((r.porte as string) || undefined),
      abertaEm: e.abertaEm ?? (r.aberta_em ? new Date(r.aberta_em as string).toISOString().slice(0, 10) : undefined),
      matriz: e.matriz ?? (r.matriz as boolean),
      cnaePrincipal: e.cnaePrincipal ?? (r.cnae ? { codigo: Number(r.cnae), descricao: (r.cnae_descricao as string) ?? "" } : undefined),
      endereco: {
        ...e.endereco,
        bairro: e.endereco?.bairro ?? ((r.bairro as string) || undefined),
        cep: e.endereco?.cep ?? ((r.cep as string) || undefined),
      },
      telefones: tel && !e.telefones.includes(tel) ? [...e.telefones, tel] : e.telefones,
      emailsCadastrais: mail && !e.emailsCadastrais.includes(mail) ? [...e.emailsCadastrais, mail] : e.emailsCadastrais,
    };
  };
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

  /** Identifica o conjunto de fontes: mudar as fontes invalida o pool, para não servir resultado de outra configuração. */
  const fonteChave = provedores.map((p) => p.nome).join("|");

  async function saiuDaBase(): Promise<Set<string>> {
    return new Set((await db.query<{ email: string }>("select email from opt_out")).rows.map((r) => r.email));
  }

  /**
   * Junta os contatos de uma empresa: usa o pool se houver varredura recente das mesmas fontes e cargos;
   * senão consulta as fontes e guarda o resultado no pool. Falha total das fontes não vai para o pool.
   */
  async function coletar(
    empresa: Empresa,
    cargosBrutos: string[],
    progresso?: (provedor: string) => void | Promise<void>,
  ): Promise<{ contatos: Contato[]; tentativas: Tentativa[]; doPool: boolean }> {
    const cargos = cargosBrutos.map((c) => c.trim().toLowerCase()).filter(Boolean);
    const cargosChave = [...new Set(cargos)].sort().join(",");
    const cnpj = chaveAlvo(empresa.cnpj);
    const saiu = await saiuDaBase();
    const naoSaiu = (c: Contato) => !(c.email && saiu.has(c.email.toLowerCase()));

    const comunidade = (await db.query<Linha>(
      "select * from base_contato where cnpj = $1 order by criado_em",
      [cnpj],
    )).rows
      .map((r): Contato => ({
        nome: r.nome as string,
        cargo: r.cargo as string,
        senioridade: (r.senioridade as string) ?? undefined,
        departamento: (r.departamento as string) ?? undefined,
        email: (r.email as string) ?? undefined,
        emailStatus: r.email ? "nao_verificado" : undefined,
        telefone: (r.telefone as string) ?? undefined,
        linkedinUrl: (r.linkedin_url as string) ?? undefined,
        origem: `${r.origem as string} (base comum)`,
        obtidoEm: new Date(r.criado_em as string).toISOString(),
        confianca: 0.6,
      }))
      .filter(naoSaiu);
    const juntar = (lista: Contato[]) => {
      const vistos = new Set(lista.map((c) => `${c.nome}|${c.cargo}`.toLowerCase()));
      return [...lista, ...comunidade.filter((c) => !vistos.has(`${c.nome}|${c.cargo}`.toLowerCase()))];
    };

    const cache = await um<{ contatos: Contato[]; tentativas: Tentativa[] }>(
      `select contatos, tentativas from pool_busca
        where cnpj = $1 and fonte_chave = $2 and cargos_chave = $3 and obtido_em > now() - (${VALIDADE_SQL})`,
      [cnpj, fonteChave, cargosChave],
    );
    if (cache) {
      return { contatos: juntar(cache.contatos.filter(naoSaiu)), tentativas: cache.tentativas, doPool: true };
    }

    const { contatos, tentativas } = await buscarEmCascata(
      provedores,
      { empresa, cargos },
      { optOut: (c) => !naoSaiu(c), progresso },
    );
    const todasFalharam = tentativas.length > 0 && tentativas.every((t) => t.erro);
    if (!todasFalharam) {
      await db.query(
        `insert into pool_busca (cnpj, fonte_chave, cargos_chave, contatos, tentativas)
         values ($1,$2,$3,$4::jsonb,$5::jsonb)
         on conflict (cnpj, fonte_chave, cargos_chave)
         do update set contatos = excluded.contatos, tentativas = excluded.tentativas, obtido_em = now()`,
        [cnpj, fonteChave, cargosChave, JSON.stringify(contatos), JSON.stringify(tentativas)],
      );
    }
    return { contatos: juntar(contatos), tentativas, doPool: false };
  }

  /** Estorna se nada foi encontrado; senão grava os contatos na organização e devolve os ids. */
  async function concluirOuEstornar(cnpj: string, contatos: Contato[], cobrancaId: string): Promise<string[]> {
    if (contatos.length === 0) {
      try {
        await db.query("select estornar_creditos($1,$2,$3)", [org, cobrancaId, "nenhum decisor encontrado"]);
      } catch (e) {
        traduzir(e);
      }
      return [];
    }
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
    return ids;
  }

  /** Marca a busca como erro e devolve o crédito (uma vez só: o estorno é único por cobrança). */
  async function falharBusca(jobId: string, cobrancaId: string | null, motivo: string) {
    if (cobrancaId) {
      await db.query("select estornar_creditos($1,$2,$3)", [org, cobrancaId, "busca não concluída"]).catch(() => undefined);
    }
    await db.query(
      `update busca_job set status = 'erro', erro = $2, etapa = 'Falhou (crédito devolvido)', atualizado_em = now()
        where id = $1 and status = 'em_andamento'`,
      [jobId, motivo],
    );
  }

  /** Buscas em andamento sem sinal de vida (servidor reiniciado ou prazo excedido) viram erro com estorno. */
  async function varrerBuscasPerdidas() {
    const perdidas = await db.query<Linha>(
      `select id, cobranca_id from busca_job where organizacao_id = $1 and status = 'em_andamento'
         and atualizado_em < now() - make_interval(mins => $2)`,
      [org, TEMPO_MAXIMO_BUSCA_MIN],
    );
    for (const p of perdidas.rows) {
      await falharBusca(p.id as string, (p.cobranca_id as string) ?? null, "A busca foi interrompida.");
    }
  }

  async function estadoDoJob(j: Linha): Promise<EstadoBusca> {
    const estado: EstadoBusca = {
      id: j.id as string,
      cnpj: j.cnpj as string,
      status: j.status as EstadoBusca["status"],
      etapa: j.etapa as string,
      doPool: j.do_pool as boolean,
      erro: (j.erro as string) ?? undefined,
    };
    if (estado.status === "concluida") {
      estado.contatos = (await guardados((j.contato_ids as string[]) ?? [])).map(visivel);
      estado.saldo = await saldo();
    }
    return estado;
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

    // ───────────── Organização, equipe e acesso ─────────────

    async organizacao() {
      const o = await um<{ id: string; nome: string; criado_em: string }>(
        "select id, nome, criado_em from organizacao where id = $1",
        [org],
      );
      return {
        id: o!.id,
        nome: o!.nome,
        criadaEm: new Date(o!.criado_em).toISOString(),
        saldo: await saldo(),
        custos: await servicos.custos(),
      };
    },

    async renomearOrganizacao(nome: string) {
      exigirAdmin();
      if (!nome.trim()) throw new ErroDeNegocio("Informe o nome da organização.");
      await db.query("select renomear_organizacao($1,$2)", [org, nome]);
      await auditar("organizacao.renomear", org, { nome: nome.trim() });
    },

    async equipe(): Promise<{ membros: Membro[]; convites: ConvitePendente[] }> {
      const m = await db.query<Linha>(
        `select m.usuario_id, m.papel, u.name, u.email
           from membro m left join neon_auth."user" u on u.id = m.usuario_id
          where m.organizacao_id = $1 order by m.papel, u.name nulls last, m.usuario_id`,
        [org],
      );
      const c = ator.papel === "administrador"
        ? await db.query<Linha>(
            `select id, email, papel, criado_em, expira_em from convite
              where organizacao_id = $1 and aceito_em is null and expira_em > now() order by criado_em desc`,
            [org],
          )
        : { rows: [] as Linha[] };
      return {
        membros: m.rows.map((r) => ({
          usuarioId: r.usuario_id as string,
          nome: (r.name as string) ?? undefined,
          email: (r.email as string) ?? undefined,
          papel: r.papel as Membro["papel"],
        })),
        convites: c.rows.map((r) => ({
          id: r.id as string,
          email: r.email as string,
          papel: r.papel as ConvitePendente["papel"],
          criadoEm: new Date(r.criado_em as string).toISOString(),
          expiraEm: new Date(r.expira_em as string).toISOString(),
        })),
      };
    },

    /** Cria um convite e devolve o token do link. O link é secreto: quem o tiver entra na organização. */
    async convidar(email: string, papel: "administrador" | "membro"): Promise<string> {
      exigirAdmin();
      const e = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ErroDeNegocio("E-mail inválido.");
      if (papel !== "administrador" && papel !== "membro") throw new ErroDeNegocio("Papel inválido.");
      const r = await um<{ t: string }>("select criar_convite($1,$2,$3) as t", [org, e, papel]);
      await auditar("equipe.convidar", e, { papel });
      return r!.t;
    },

    async revogarConvite(id: string) {
      exigirAdmin();
      if (!UUID.test(id)) throw new ErroDeNegocio("Convite não encontrado.", 404);
      await db.query("delete from convite where id = $1 and organizacao_id = $2 and aceito_em is null", [id, org]);
      await auditar("equipe.revogar_convite", id);
    },

    async alterarPapel(usuarioId: string, papel: "administrador" | "membro") {
      exigirAdmin();
      if (!UUID.test(usuarioId) || (papel !== "administrador" && papel !== "membro")) throw new ErroDeNegocio("Dados inválidos.");
      try {
        await db.query("update membro set papel = $3 where organizacao_id = $1 and usuario_id = $2", [org, usuarioId, papel]);
      } catch (e) {
        traduzir(e);
      }
      await auditar("equipe.papel", usuarioId, { papel });
    },

    async removerMembro(usuarioId: string) {
      exigirAdmin();
      if (!UUID.test(usuarioId)) throw new ErroDeNegocio("Dados inválidos.");
      try {
        await db.query("delete from membro where organizacao_id = $1 and usuario_id = $2", [org, usuarioId]);
      } catch (e) {
        traduzir(e);
      }
      await auditar("equipe.remover", usuarioId);
    },

    /** Aceita um convite em nome do usuário logado e devolve a organização em que ele entrou. */
    async aceitarConvite(token: string): Promise<string> {
      try {
        const r = await um<{ o: string }>("select aceitar_convite($1) as o", [token]);
        return r!.o;
      } catch (e) {
        return traduzir(e);
      }
    },

    async auditoriaRecente(limite = 50) {
      exigirAdmin();
      const r = await db.query<Linha>(
        `select a.criado_em, a.acao, a.alvo, a.detalhe, u.name, u.email
           from auditoria a left join neon_auth."user" u on u.id = a.usuario_id
          where a.organizacao_id = $1 order by a.id desc limit $2`,
        [org, limite],
      );
      return r.rows.map((x) => ({
        quando: new Date(x.criado_em as string).toISOString(),
        acao: x.acao as string,
        alvo: (x.alvo as string) ?? undefined,
        detalhe: x.detalhe as Record<string, unknown>,
        quem: ((x.name as string) || (x.email as string)) ?? undefined,
      }));
    },

    // ───────────── Pesquisa avançada ─────────────

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
      const temFiltro = nome || termos.length || uf || cidade || bairro || segmento || setores.length || portes.length || abertura || f.comEmail || f.comTelefone;
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

    // ───────────── Base colaborativa ─────────────

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

    // ───────────── Operadora da plataforma ─────────────

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

    /**
     * Opt-out global: o e-mail não volta em buscas futuras e os dados já guardados são apagados
     * (e-mail e telefone do contato em todas as organizações).
     */
    async registrarOptOut(email: string): Promise<{ contatosAfetados: number }> {
      const e = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ErroDeNegocio("E-mail inválido.");
      const r = await um<{ n: number }>("select aplicar_opt_out($1) as n", [e]);
      return { contatosAfetados: r?.n ?? 0 };
    },

    /**
     * Cria um pedido de opt-out a ser confirmado pelo link enviado ao e-mail. Devolve o token (só vai para o
     * e-mail, o banco guarda o hash) ou null quando já há pedidos demais para esse e-mail na última hora.
     */
    async pedirOptOut(email: string): Promise<string | null> {
      const e = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ErroDeNegocio("E-mail inválido.");
      const recentes = await um<{ n: number }>(
        "select count(*)::int as n from optout_pedido where email = $1 and criado_em > now() - interval '1 hour'",
        [e],
      );
      if ((recentes?.n ?? 0) >= 3) return null;
      const token = randomBytes(32).toString("hex");
      await db.query("insert into optout_pedido (token_hash, email) values ($1, $2)", [hashToken(token), e]);
      return token;
    },

    /** Confirma um pedido de opt-out pelo token do e-mail e aplica o apagamento. Cada token vale uma vez. */
    async confirmarOptOut(token: string): Promise<{ contatosAfetados: number }> {
      if (!/^[0-9a-f]{64}$/.test(token)) throw new ErroDeNegocio("Link inválido ou expirado.", 400);
      const p = await um<{ email: string }>(
        `update optout_pedido set usado_em = now()
          where token_hash = $1 and usado_em is null and expira_em > now() returning email`,
        [hashToken(token)],
      );
      if (!p) throw new ErroDeNegocio("Link inválido ou expirado.", 400);
      return servicos.registrarOptOut(p.email);
    },

    /**
     * Limite de pedidos por chave (ex.: IP), contado no banco para valer em todos os servidores.
     * Devolve true se o pedido pode seguir (e já o conta).
     */
    async permitirPedido(chave: string, maximo: number, janelaSegundos: number): Promise<boolean> {
      const r = await um<{ n: number }>(
        "select count(*)::int as n from limite_pedido where chave = $1 and criado_em > now() - make_interval(secs => $2)",
        [chave, janelaSegundos],
      );
      if ((r?.n ?? 0) >= maximo) return false;
      await db.query("insert into limite_pedido (chave) values ($1)", [chave]);
      // Limpeza ocasional, para a tabela não crescer.
      if (Math.random() < 0.02) await db.query("delete from limite_pedido where criado_em < now() - interval '1 day'");
      return true;
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

    /** Sinal de compra genérico (rádio, vaga aberta, licitação, notícia etc.), sempre com fonte e data. */
    async registrarSinal(p: { cnpj: string; tipo: string; fonte: string; ocorridoEm: string; conteudo?: unknown }) {
      if (!alvoValido(p.cnpj)) throw new ErroDeNegocio("CNPJ inválido.");
      if (!p.tipo.trim() || !p.fonte.trim()) throw new ErroDeNegocio("Informe o tipo e a fonte do sinal.");
      const quando = new Date(p.ocorridoEm);
      if (Number.isNaN(quando.getTime())) throw new ErroDeNegocio("Data do sinal inválida.");
      const r = await um<{ id: string }>(
        `insert into sinal (organizacao_id, tipo, fonte, cnpj, ocorrido_em, conteudo)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [org, p.tipo.trim(), p.fonte.trim(), chaveAlvo(p.cnpj), quando.toISOString(), JSON.stringify(p.conteudo ?? {})],
      );
      return { id: r!.id };
    },

    async sinaisDoCnpj(cnpj: string) {
      if (!alvoValido(cnpj)) throw new ErroDeNegocio("CNPJ inválido.");
      const r = await db.query<Linha>(
        `select id, tipo, fonte, ocorrido_em, conteudo from sinal
          where cnpj = $1 and (organizacao_id is null or organizacao_id = $2)
          order by ocorrido_em desc limit 100`,
        [chaveAlvo(cnpj), org],
      );
      return r.rows.map((x) => ({
        id: x.id as string,
        tipo: x.tipo as string,
        fonte: x.fonte as string,
        ocorridoEm: new Date(x.ocorrido_em as string).toISOString(),
        conteudo: x.conteudo,
      }));
    },
  };
  return servicos;
}

export type ServicosPg = ReturnType<typeof criarServicosPg>;
