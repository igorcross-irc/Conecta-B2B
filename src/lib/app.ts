import { Razao } from "./credits";
import { CnpjaAberta } from "./providers/cnpja";
import { EmpresaDemo, ProvedorDemo } from "./providers/mock";
import { criarServicos, ErroDeNegocio, type Servicos } from "./servicos";

/**
 * Instância única de serviços do processo.
 * ATENÇÃO: o estado fica em memória (some ao reiniciar) e há uma só organização de demonstração.
 * Será trocado pelo Supabase (ver supabase/migrations) quando houver autenticação e multi-tenant.
 */
const globalComServicos = globalThis as unknown as { __conectaServicos?: Servicos };

export function servicos(): Servicos {
  if (!globalComServicos.__conectaServicos) {
    globalComServicos.__conectaServicos = criarServicos({
      empresa:
        process.env.CONECTA_MODO_DEMO === "1" ? new EmpresaDemo() : new CnpjaAberta(),
      contatos: [new ProvedorDemo()],
      razao: new Razao(20),
    });
  }
  return globalComServicos.__conectaServicos;
}

/** Converte erros de negócio em resposta JSON com o status certo. */
export function responderErro(e: unknown): Response {
  if (e instanceof ErroDeNegocio) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
  return Response.json({ erro: mensagem }, { status: 502 });
}
