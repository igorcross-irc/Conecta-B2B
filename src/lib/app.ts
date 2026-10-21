import { abrirBancoLocal } from "@/db/local";
import { CnpjaAberta } from "./providers/cnpja";
import { EmpresaDemo, ProvedorDemo } from "./providers/mock";
import { criarServicosPg, type ServicosPg } from "./servicosPg";
import { ErroDeNegocio } from "./servicos";

/**
 * Instância única de serviços do processo, sobre o banco local (Postgres embutido, pasta .dados).
 * Há uma só organização de demonstração. Será trocado pelo Supabase quando houver autenticação.
 */
const g = globalThis as unknown as { __conectaServicos?: Promise<ServicosPg> };

export function servicos(): Promise<ServicosPg> {
  g.__conectaServicos ??= abrirBancoLocal().then((db) =>
    criarServicosPg({
      db,
      empresa: process.env.CONECTA_MODO_DEMO === "1" ? new EmpresaDemo() : new CnpjaAberta(),
      contatos: [new ProvedorDemo()],
    }),
  );
  return g.__conectaServicos;
}

/** Converte erros de negócio em resposta JSON com o status certo. */
export function responderErro(e: unknown): Response {
  if (e instanceof ErroDeNegocio) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
  return Response.json({ erro: mensagem }, { status: 502 });
}
