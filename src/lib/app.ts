import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { abrirBanco, type Banco } from "@/db/conexao";
import { BrasilApi, EmpresaEmCascata, minhaReceita } from "./providers/brasilapi";
import { CnpjaAberta } from "./providers/cnpja";
import { SiteEmpresa } from "./providers/site";
import { SociosReceita } from "./providers/socios";
import { CvmRelacoesInvestidores } from "./providers/cvmri";
import { Hunter } from "./providers/hunter";
import { BuscaWebPessoas } from "./providers/buscaweb";
import { chaveGemini } from "./ia/gemini";
import { EmpresaDemo, ProvedorDemo } from "./providers/mock";
import { obterSessao } from "./sessao";
import { criarServicosPg, type ServicosPg } from "./servicosPg";
import { ErroDeNegocio } from "./servicos";
import { emailConfigurado, enviarEmail as enviarEmailBruto, urlPublica } from "./email";
import { log, mensagemDe } from "./log";
import { medir, monitorarContatos, monitorarEmpresa, type Execucao } from "./monitor";

/**
 * Banco e provedores são únicos no processo; os serviços são criados a cada requisição,
 * já em nome do usuário e da organização da sessão.
 * Banco: DATABASE_URL (Neon) quando definida, senão o banco local embutido (pasta .dados).
 */
const g = globalThis as unknown as { __conectaBanco?: Promise<Banco> };

/** Envio de e-mail com monitoramento (sucesso, falha e tempo). */
const enviarEmail: typeof enviarEmailBruto = (m, http) => medir("Resend (e-mail)", "email", () => enviarEmailBruto(m, http), registrarExecucao, () => 1);

const banco$ = () => (g.__conectaBanco ??= abrirBanco());

/** Grava cada chamada a uma fonte (sucesso, falha e tempo) para o painel Plataforma > Provedores. Nunca derruba a chamada. */
async function registrarExecucao(e: Execucao): Promise<void> {
  const banco = await banco$();
  await banco.comUsuario(ZERO).query(
    "insert into provedor_execucao (provedor, tipo, ok, ms, itens, erro) values ($1,$2,$3,$4,$5,$6)",
    [e.provedor, e.tipo, e.ok, e.ms, e.itens ?? null, e.erro ?? null],
  );
  if (Math.random() < 0.01) await banco.comUsuario(ZERO).query("select limpar_monitoramento()");
}

/** Registra uma fonte avulsa (IA, e-mail) no monitoramento. */
export const registrarFonte = registrarExecucao;

/** Guarda um erro inesperado para o painel Plataforma > Saúde (e no log). Nunca lança. */
export async function registrarErroApp(origem: string, e: unknown, detalhe?: string): Promise<void> {
  log.error("erro_app", { origem, erro: mensagemDe(e), detalhe });
  try {
    const banco = await banco$();
    await banco.comUsuario(ZERO).query("insert into erro_app (origem, mensagem, detalhe) values ($1,$2,$3)", [origem, mensagemDe(e), detalhe ? detalhe.slice(0, 500) : null]);
  } catch {
    /* sem banco: o log acima já tem o erro */
  }
}

/**
 * Fontes gratuitas por padrão: BrasilAPI e CNPJá para a empresa; sócios da Receita e páginas públicas
 * do site para os contatos. Provedores pagos entram depois, à frente na lista, sem mexer no resto.
 * CONECTA_MODO_DEMO=1 troca tudo por dados fictícios.
 */
function provedores() {
  if (process.env.CONECTA_MODO_DEMO === "1") {
    // Dados fictícios em produção seriam cobrados e entregues como se fossem reais: recusa.
    if (process.env.VERCEL_ENV === "production") throw new ErroDeNegocio("CONECTA_MODO_DEMO não pode ficar ligado em produção.", 500);
    return { empresa: new EmpresaDemo(), contatos: [new ProvedorDemo()] };
  }
  const site = new SiteEmpresa();
  const mon = <P extends Parameters<typeof monitorarContatos>[0]>(p: P) => monitorarContatos(p, registrarExecucao);
  return {
    registrar: registrarExecucao,
    empresa: new EmpresaEmCascata([
      monitorarEmpresa(new BrasilApi(), registrarExecucao),
      monitorarEmpresa(minhaReceita(), registrarExecucao),
      monitorarEmpresa(new CnpjaAberta(), registrarExecucao),
    ]),
    contatos: [
      mon(new SociosReceita()),
      mon(new CvmRelacoesInvestidores()),
      mon(site),
      // Fontes extras entram quando a chave existe no ambiente (Vercel → Settings → Environment Variables).
      ...(process.env.HUNTER_API_KEY ? [mon(new Hunter(process.env.HUNTER_API_KEY))] : []),
      ...(process.env.TAVILY_API_KEY && chaveGemini()
        ? [mon(new BuscaWebPessoas(process.env.TAVILY_API_KEY, chaveGemini()!, process.env.GEMINI_MODEL))]
        : []),
    ],
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

function servicosPublicos() {
  return banco$().then((banco) => criarServicosPg({ db: banco.comUsuario(ZERO), org: ZERO, ...provedores() }));
}

/**
 * Cota de consultas pesadas (pesquisa, mercado, parecidas) por usuário: 600 por hora, contada no banco.
 * Serve de freio contra uso em laço, que varreria a base da Receita sem parar.
 */
export async function consultaPermitida(): Promise<boolean> {
  const { sessao, servicos } = await contexto();
  return servicos.permitirPedido(`consulta:${sessao.usuarioId}`, 600, 3600);
}

/** Limite de pedidos para rotas públicas, contado no banco (vale em todos os servidores). */
export async function permitirPedidoPublico(chave: string, maximo: number, janelaSegundos: number) {
  return (await servicosPublicos()).permitirPedido(chave, maximo, janelaSegundos);
}

/**
 * Pedido público de opt-out. Com envio de e-mail configurado, só cria o pedido e manda o link de confirmação
 * (o apagamento acontece quando o dono do e-mail confirma). Sem envio configurado, aplica na hora.
 * A resposta é sempre a mesma, para não revelar se o e-mail está em nossa base.
 */
export async function pedirOptOutPublico(email: string): Promise<{ confirmacaoPorEmail: boolean }> {
  const s = await servicosPublicos();
  if (!emailConfigurado()) {
    await s.registrarOptOut(email);
    return { confirmacaoPorEmail: false };
  }
  const token = await s.pedirOptOut(email);
  if (token) {
    await enviarEmail({
      para: email.trim().toLowerCase(),
      assunto: "Confirme seu pedido para não ser contatado",
      texto:
        "Recebemos um pedido para apagar seus dados de contato e não listar mais o seu e-mail nas buscas do Conecta B2B.\n\n" +
        `Para confirmar, abra: ${urlPublica()}/optout/confirmar?token=${token}\n\n` +
        "O link vale por 2 horas. Se não foi você, ignore esta mensagem: nada será apagado.",
    });
  }
  return { confirmacaoPorEmail: true };
}

/**
 * Serviços de uma requisição da API pública (chave no cabeçalho Authorization: Bearer cb2b_...).
 * Devolve uma Response de erro pronta quando a chave falta, é inválida ou passou do limite de 600 pedidos por hora.
 */
export async function servicosPorChave(req: Request): Promise<{ servicos: ServicosPg } | { erro: Response }> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer (cb2b_[0-9a-f]{48})$/);
  if (!m) return { erro: Response.json({ erro: "Envie a chave em Authorization: Bearer cb2b_..." }, { status: 401 }) };
  const banco = await banco$();
  const publico = criarServicosPg({ db: banco.comUsuario(ZERO), org: ZERO, ...provedores() });
  const dono = await publico.validarChaveApi(m[1]);
  if (!dono) return { erro: Response.json({ erro: "Chave inválida ou revogada." }, { status: 401 }) };
  const servicos = criarServicosPg({
    db: banco.comUsuario(dono.usuarioId),
    org: dono.orgId,
    ator: { usuarioId: dono.usuarioId, papel: "administrador", operadora: false },
    ...provedores(),
  });
  if (!(await servicos.permitirPedido(`api:${dono.orgId}`, 600, 3600))) {
    return { erro: Response.json({ erro: "Limite de 600 pedidos por hora atingido." }, { status: 429 }) };
  }
  return { servicos };
}

/** Avisos diários das pesquisas salvas (chamado pelo cron). */
export async function rodarAlertasPublico() {
  return (await servicosPublicos()).rodarAlertas(enviarEmail, urlPublica());
}

/** Aviso por e-mail à operadora quando alguma fonte de dados cai (chamado pelo cron; destino em OPERADORA_EMAIL). */
export async function avisarFontesPublico(para: string) {
  return (await servicosPublicos()).avisarFontesForaDoAr(enviarEmail, para, urlPublica());
}

export async function confirmarOptOutPublico(token: string) {
  return (await servicosPublicos()).confirmarOptOut(token);
}

/** Converte erros de negócio em resposta JSON com o status certo. */
export function responderErro(e: unknown): Response {
  // Sinais internos do Next (página dinâmica, redirecionamento) não são erros: precisam seguir adiante.
  unstable_rethrow(e);
  if (e instanceof ErroDeNegocio) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  void registrarErroApp("rota", e);
  const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
  return Response.json({ erro: mensagem }, { status: 502 });
}
