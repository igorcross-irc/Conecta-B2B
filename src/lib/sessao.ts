import type { Banco } from "@/db/conexao";
import { ORG_DEMO, USUARIO_DEMO } from "@/db/local";
import { getAuth } from "./auth/server";
import { ErroDeNegocio } from "./servicos";

/** Quem está usando o sistema e em nome de qual organização. */
export interface Sessao {
  usuarioId: string;
  orgId: string;
}

const orgDoUsuario = new Map<string, string>();

/**
 * Descobre a sessão da requisição.
 * Com login configurado (Neon Auth): valida a sessão e acha, ou cria no primeiro acesso, a
 * organização do usuário. Sem login: usuário fixo de demonstração.
 */
export async function obterSessao(banco: Banco): Promise<Sessao> {
  const auth = getAuth();
  if (!auth) return { usuarioId: USUARIO_DEMO, orgId: ORG_DEMO };
  if (!process.env.DATABASE_URL) {
    throw new ErroDeNegocio("O login exige DATABASE_URL (Neon) configurada.", 500);
  }
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user?.id) throw new ErroDeNegocio("Faça login para continuar.", 401);

  let orgId = orgDoUsuario.get(user.id);
  if (!orgId) {
    const r = await banco
      .comUsuario(user.id)
      .query<{ o: string }>("select garantir_organizacao($1, $2) as o", [
        user.id,
        user.name ? `Organização de ${user.name}` : "Minha organização",
      ]);
    orgId = r.rows[0].o;
    orgDoUsuario.set(user.id, orgId);
  }
  return { usuarioId: user.id, orgId };
}
