import { ORG_DEMO, USUARIO_DEMO } from "@/db/local";

/** Quem está usando o sistema e em nome de qual organização. */
export interface Sessao {
  usuarioId: string;
  orgId: string;
}

/**
 * Descobre a sessão da requisição.
 * Hoje devolve o usuário fixo de demonstração. O login (Neon Auth) entra aqui:
 * valida o token, acha o usuário e a organização dele (tabela membro).
 */
export async function obterSessao(_headers: Headers): Promise<Sessao> {
  void _headers;
  return { usuarioId: USUARIO_DEMO, orgId: ORG_DEMO };
}
