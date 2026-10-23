import { cache } from "react";
import { abrirBanco, type Banco } from "@/db/conexao";
import { BrasilApi, EmpresaEmCascata } from "./providers/brasilapi";
import { CnpjaAberta } from "./providers/cnpja";
import { SiteEmpresa } from "./providers/site";
import { SociosReceita } from "./providers/socios";
import { EmpresaDemo, ProvedorDemo } from "./providers/mock";
import { obterSessao } from "./sessao";
import { criarServicosPg, type ServicosPg } from "./servicosPg";
import { ErroDeNegocio } from "./servicos";

/**
 * Banco e provedores são únicos no processo; os serviços são criados a cada requisição,
 * já em nome do usuário e da organização da sessão.
 * Banco: DATABASE_URL (Neon) quando definida, senão o banco local embutido (pasta .dados).
 */
const g = globalThis as unknown as { __conectaBanco?: Promise<Banco> };

const banco$ = () => (g.__conectaBanco ??= abrirBanco());

/**
 * Fontes gratuitas por padrão: BrasilAPI e CNPJá para a empresa; sócios da Receita e páginas públicas
 * do site para os contatos. Provedores pagos entram depois, à frente na lista, sem mexer no resto.
 * CONECTA_MODO_DEMO=1 troca tudo por dados fictícios.
 */
function provedores() {
  if (process.env.CONECTA_MODO_DEMO === "1") {
    return { empresa: new EmpresaDemo(), contatos: [new ProvedorDemo()] };
  }
  const site = new SiteEmpresa();
  return {
    empresa: new EmpresaEmCascata([new BrasilApi(), new CnpjaAberta()]),
    contatos: [new SociosReceita(), site],
    descobridor: (dominio: string) => site.descobrirCnpjs(dominio),
  };
}

/** Serviços em nome do usuário logado (ou do usuário de demonstração, sem login configurado). */
export async function servicos(): Promise<ServicosPg> {
  return (await contexto()).servicos;
}

/** Sessão e serviços da requisição, para páginas e ações. */
export const contexto = cache(async function contexto() {
  const banco = await banco$();
  const sessao = await obterSessao(banco);
  return {
    sessao,
    servicos: criarServicosPg({
      db: banco.comUsuario(sessao.usuarioId),
      org: sessao.orgId,
      ator: { usuarioId: sessao.usuarioId, papel: sessao.papel, operadora: sessao.operadora },
      ...provedores(),
    }),
  };
});

const ZERO = "00000000-0000-0000-0000-000000000000";

/** Opt-out público: quem pede para sair não tem conta, então roda sem sessão de cliente. */
export async function registrarOptOutPublico(email: string) {
  const banco = await banco$();
  return criarServicosPg({ db: banco.comUsuario(ZERO), org: ZERO, ...provedores() }).registrarOptOut(email);
}

/** Converte erros de negócio em resposta JSON com o status certo. */
export function responderErro(e: unknown): Response {
  if (e instanceof ErroDeNegocio) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
  return Response.json({ erro: mensagem }, { status: 502 });
}
