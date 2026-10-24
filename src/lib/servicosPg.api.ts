import { randomBytes } from "node:crypto";
import { ErroDeNegocio } from "./erros";
import { Linha, UUID, hashToken } from "./servicosPg.tipos";
import type { Ctx } from "./servicosPg.contexto";

/** Serviços do grupo "api". */
export function criarApi(c: Ctx) {
  const { db, org, ator, exigirAdmin, auditar, um } = c;
  return {
    async chavesApi() {
      exigirAdmin();
      const r = await db.query<Linha>(
        "select id, nome, prefixo, criado_em, ultimo_uso, revogada_em from api_chave where organizacao_id = $1 order by criado_em desc limit 50",
        [org],
      );
      return r.rows.map((x) => ({
        id: x.id as string, nome: x.nome as string, prefixo: x.prefixo as string,
        criadaEm: new Date(x.criado_em as string).toISOString(),
        ultimoUso: x.ultimo_uso ? new Date(x.ultimo_uso as string).toISOString() : undefined,
        revogada: Boolean(x.revogada_em),
      }));
    },
    /** Cria a chave e devolve o texto UMA vez; o banco guarda só o hash. */
    async criarChaveApi(nome: string): Promise<string> {
      exigirAdmin();
      const n = nome.trim();
      if (!n || n.length > 80) throw new ErroDeNegocio("Dê um nome de até 80 caracteres à chave.");
      const ativas = (await um<{ n: number }>("select count(*)::int as n from api_chave where organizacao_id = $1 and revogada_em is null", [org]))?.n ?? 0;
      if (ativas >= 10) throw new ErroDeNegocio("Limite de 10 chaves ativas. Revogue alguma antes.");
      const chave = `cb2b_${randomBytes(24).toString("hex")}`;
      const r = await um<{ id: string }>(
        "insert into api_chave (organizacao_id, criado_por, nome, prefixo, hash) values ($1,$2,$3,$4,$5) returning id",
        [org, ator.usuarioId, n, chave.slice(0, 9), hashToken(chave)],
      );
      await auditar("api.criar_chave", r!.id, { nome: n });
      return chave;
    },
    async revogarChaveApi(id: string): Promise<void> {
      exigirAdmin();
      if (!UUID.test(id)) throw new ErroDeNegocio("Chave não encontrada.", 404);
      await db.query("update api_chave set revogada_em = now() where id = $1 and organizacao_id = $2 and revogada_em is null", [id, org]);
      await auditar("api.revogar_chave", id);
    },
    /** Resolve uma chave de API para a organização e o usuário dono dela (sem sessão). null se inválida ou revogada. */
    async validarChaveApi(chave: string): Promise<{ orgId: string; usuarioId: string } | null> {
      if (!/^cb2b_[0-9a-f]{48}$/.test(chave)) return null;
      const r = await um<{ organizacao_id: string; usuario_id: string }>("select * from api_chave_validar($1)", [hashToken(chave)]);
      return r ? { orgId: r.organizacao_id, usuarioId: r.usuario_id } : null;
    },
  };
}
