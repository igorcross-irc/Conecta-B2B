import { cache } from "react";
import { cookies } from "next/headers";
import type { Banco } from "@/db/conexao";
import { ORG_DEMO, USUARIO_DEMO } from "@/db/local";
import { getAuth } from "./auth/server";
import { ErroDeNegocio } from "./servicos";

export type Papel = "administrador" | "membro";

export interface OrgDoUsuario {
  id: string;
  nome: string;
  papel: Papel;
}

/** Quem está usando o sistema, em nome de qual organização e com quais permissões. */
export interface Sessao {
  usuarioId: string;
  orgId: string;
  papel: Papel;
  /** Operadora da plataforma: administra todas as organizações. */
  operadora: boolean;
  nome?: string;
  email?: string;
  orgs: OrgDoUsuario[];
  /** Sem login configurado: usuário fixo de demonstração. */
  demo: boolean;
}

export const COOKIE_ORG = "conecta_org";

/** Créditos que uma organização nova recebe (CONECTA_CREDITOS_INICIAIS; 0 = nenhum). */
function creditosIniciais(): number {
  const n = Number(process.env.CONECTA_CREDITOS_INICIAIS ?? 20);
  return Number.isInteger(n) && n >= 0 ? n : 20;
}

/**
 * Descobre a sessão da requisição.
 * Com login (Neon Auth): valida a sessão, cria a organização no primeiro acesso e escolhe a organização
 * ativa pelo cookie (entre as de que o usuário é membro). Sem login: usuário fixo de demonstração.
 */
export const obterSessao = cache(async (banco: Banco): Promise<Sessao> => {
  const auth = getAuth();
  if (!auth) {
    return {
      usuarioId: USUARIO_DEMO,
      orgId: ORG_DEMO,
      papel: "administrador",
      operadora: true,
      nome: "Usuário de demonstração",
      orgs: [{ id: ORG_DEMO, nome: "Organização de demonstração", papel: "administrador" }],
      demo: true,
    };
  }
  if (!process.env.DATABASE_URL) {
    throw new ErroDeNegocio("O login exige DATABASE_URL (Neon) configurada.", 500);
  }
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user?.id) throw new ErroDeNegocio("Faça login para continuar.", 401);

  const db = banco.comUsuario(user.id);
  const buscarOrgs = async () =>
    (
      await db.query<{ id: string; nome: string; papel: Papel }>(
        `select o.id, o.nome, m.papel from membro m join organizacao o on o.id = m.organizacao_id
          where m.usuario_id = $1 order by o.criado_em, o.id`,
        [user.id],
      )
    ).rows;
  let orgs = await buscarOrgs();
  if (orgs.length === 0) {
    await db.query("select garantir_organizacao($1, $2, $3)", [
      user.id,
      user.name ? `Organização de ${user.name}` : "Minha organização",
      creditosIniciais(),
    ]);
    orgs = await buscarOrgs();
  }
  const escolhida = (await cookies()).get(COOKIE_ORG)?.value;
  const ativa = orgs.find((o) => o.id === escolhida) ?? orgs[0];
  const operadora =
    (await db.query("select 1 from operadora where usuario_id = $1", [user.id])).rows.length > 0;
  return {
    usuarioId: user.id,
    orgId: ativa.id,
    papel: ativa.papel,
    operadora,
    nome: user.name || undefined,
    email: user.email || undefined,
    orgs,
    demo: false,
  };
});
