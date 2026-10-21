import { abrirBanco, type Banco } from "@/db/conexao";
import { CnpjaAberta } from "./providers/cnpja";
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

export async function servicos(headers: Headers): Promise<ServicosPg> {
  g.__conectaBanco ??= abrirBanco();
  const [banco, sessao] = await Promise.all([g.__conectaBanco, obterSessao(headers)]);
  return criarServicosPg({
    db: banco.comUsuario(sessao.usuarioId),
    org: sessao.orgId,
    empresa: process.env.CONECTA_MODO_DEMO === "1" ? new EmpresaDemo() : new CnpjaAberta(),
    contatos: [new ProvedorDemo()],
  });
}

/** Converte erros de negócio em resposta JSON com o status certo. */
export function responderErro(e: unknown): Response {
  if (e instanceof ErroDeNegocio) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
  return Response.json({ erro: mensagem }, { status: 502 });
}
