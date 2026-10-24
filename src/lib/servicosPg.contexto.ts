import { buscarEmCascata, type Tentativa } from "./cascade";
import { chaveAlvo } from "./cnpj";
import { ORG_DEMO, USUARIO_DEMO } from "@/db/local";
import { verificarDominiosDeEmail } from "./providers/mx";
import { type Contato, type Empresa, VERSAO_EMPRESA } from "./providers/types";
import { ErroDeNegocio, visivel, type ContatoGuardado } from "./servicos";
import { Ator, Cruzados, Dependencias, EstadoBusca, Linha, SELECT_CONTATO, TEMPO_MAXIMO_BUSCA_MIN, VALIDADE_SQL, paraGuardado, traduzir } from "./servicosPg.tipos";


/**
 * Auxiliares compartilhados pelos grupos de serviços (cobrança, coleta de contatos, auditoria, acesso ao banco).
 * Cada grupo recebe este contexto e devolve só os seus métodos; `servicos` aponta para o objeto final,
 * para um grupo poder chamar métodos de outro.
 */
export function criarAuxiliares(deps: Dependencias, servicos: Cruzados) {
  const {
    db,
    empresa: provedorEmpresa,
    contatos: provedores,
    descobridor,
    registrar,
    org = ORG_DEMO,
    ator = { usuarioId: USUARIO_DEMO, papel: "administrador", operadora: true } as Ator,
  } = deps;

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

    const cascata = await buscarEmCascata(
      provedores,
      { empresa, cargos },
      { optOut: (c) => !naoSaiu(c), progresso },
    );
    const tentativas = cascata.tentativas;
    // Descarta e-mail de domínio que não recebe mensagens e marca os demais (checagem gratuita por MX).
    const contatos = await verificarDominiosDeEmail(cascata.contatos);
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

  return { db, org, ator, provedorEmpresa, provedores, descobridor, registrar, servicos, exigirAdmin, exigirOperadora, auditar, um, guardados, temBaseReceita, linhaReceita, telefoneBr, empresaDaReceita, completarComReceita, saldo, cobrar, fonteChave, saiuDaBase, coletar, concluirOuEstornar, falharBusca, varrerBuscasPerdidas, estadoDoJob };
}

export type Ctx = ReturnType<typeof criarAuxiliares>;
