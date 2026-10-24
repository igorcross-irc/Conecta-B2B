import { ErroDeNegocio } from "./erros";
import { ConvitePendente, Linha, Membro, UUID, traduzir } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "equipe". */
export function criarEquipe(c: Ctx) {
  const { db, org, ator, exigirAdmin, auditar, um, saldo, servicos } = c;
  return {
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
  };
}
