"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { contexto } from "@/lib/app";
import { COOKIE_ORG } from "@/lib/sessao";
import { ErroDeNegocio } from "@/lib/servicos";
import type { TabelaCustos } from "@/lib/credits";

export interface Resultado {
  erro?: string;
  ok?: string;
  link?: string;
  /** Chave de API recém-criada: aparece uma única vez. */
  chave?: string;
}

async function executar(fn: () => Promise<Resultado | void>, rev?: string): Promise<Resultado> {
  try {
    const r = (await fn()) ?? {};
    if (rev) revalidatePath(rev);
    return r;
  } catch (e) {
    if (e instanceof ErroDeNegocio) return { erro: e.message };
    return { erro: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

export async function trocarOrganizacao(dados: FormData) {
  const id = texto(dados, "org");
  const { sessao } = await contexto();
  if (sessao.orgs.some((o) => o.id === id)) {
    (await cookies()).set(COOKIE_ORG, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect("/descobrir");
}

export async function renomearOrganizacao(_: Resultado, d: FormData): Promise<Resultado> {
  return executar(async () => {
    await (await contexto()).servicos.renomearOrganizacao(texto(d, "nome"));
    return { ok: "Nome atualizado." };
  }, "/", );
}

export async function convidar(_: Resultado, d: FormData): Promise<Resultado> {
  return executar(async () => {
    const papel = texto(d, "papel") === "administrador" ? "administrador" : "membro";
    const token = await (await contexto()).servicos.convidar(texto(d, "email"), papel);
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    return { ok: "Convite criado. Envie o link abaixo para a pessoa (vale por 7 dias).", link: `${proto}://${host}/convite/${token}` };
  }, "/equipe");
}

export async function revogarConvite(d: FormData) {
  await executar(async () => (await contexto()).servicos.revogarConvite(texto(d, "id")), "/equipe");
}

export async function alterarPapel(d: FormData) {
  const papel = texto(d, "papel") === "administrador" ? "administrador" : "membro";
  await executar(async () => (await contexto()).servicos.alterarPapel(texto(d, "usuario"), papel), "/equipe");
}

export async function removerMembro(d: FormData) {
  await executar(async () => (await contexto()).servicos.removerMembro(texto(d, "usuario")), "/equipe");
}

export async function atualizarEmpresa(_: Resultado, d: FormData): Promise<Resultado> {
  const cnpj = texto(d, "cnpj");
  return executar(async () => {
    await (await contexto()).servicos.atualizarInfoEmpresa({
      cnpj,
      dominio: texto(d, "dominio"),
      nota: texto(d, "nota"),
      tags: texto(d, "tags").split(","),
    });
    return { ok: "Informações salvas para todos os usuários." };
  }, `/base/${cnpj}`);
}

export async function contribuirContato(_: Resultado, d: FormData): Promise<Resultado> {
  const cnpj = texto(d, "cnpj");
  return executar(async () => {
    await (await contexto()).servicos.contribuirContato({
      cnpj,
      nome: texto(d, "nome"),
      cargo: texto(d, "cargo"),
      email: texto(d, "email"),
      telefone: texto(d, "telefone"),
      linkedinUrl: texto(d, "linkedin"),
    });
    return { ok: "Contato adicionado à base comum. Obrigado por contribuir!" };
  }, `/base/${cnpj}`);
}

export async function aceitarConvite(d: FormData) {
  const r = await executar(async () => {
    const orgId = await (await contexto()).servicos.aceitarConvite(texto(d, "token"));
    (await cookies()).set(COOKIE_ORG, orgId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  });
  if (r.erro) redirect(`/convite/${texto(d, "token")}?erro=${encodeURIComponent(r.erro)}`);
  redirect("/descobrir");
}

export async function recarregar(_: Resultado, d: FormData): Promise<Resultado> {
  return executar(async () => {
    await (await contexto()).servicos.adminRecarregar(texto(d, "org"), Number(texto(d, "valor")), texto(d, "descricao"));
    return { ok: "Créditos adicionados." };
  }, "/admin");
}

export async function salvarCustos(_: Resultado, d: FormData): Promise<Resultado> {
  return executar(async () => {
    const custos: TabelaCustos = {
      busca_decisores: Number(texto(d, "busca_decisores")),
      revelar_email: Number(texto(d, "revelar_email")),
      revelar_telefone: Number(texto(d, "revelar_telefone")),
    };
    await (await contexto()).servicos.adminAtualizarCustos(texto(d, "org"), custos);
    return { ok: "Custos atualizados." };
  }, "/admin");
}

/** Teste de IA (Gemini): só a operadora da plataforma. */
export async function testarIA(prompt: string): Promise<import("@/lib/ia/gemini").ResultadoIA> {
  const { sessao } = await contexto();
  if (!sessao.operadora) return { ok: false, chave: false, erro: "Acesso restrito à operadora." };
  const { testarGemini } = await import("@/lib/ia/gemini");
  return testarGemini(prompt.slice(0, 500));
}

export async function salvarPesquisaAcao(d: FormData) {
  const volta = `/pesquisar?${texto(d, "volta")}`;
  const r = await executar(async () => {
    let filtros: unknown = {};
    try {
      filtros = JSON.parse(texto(d, "filtros"));
    } catch {
      throw new ErroDeNegocio("Filtros inválidos.");
    }
    await (await contexto()).servicos.salvarPesquisa(texto(d, "nome"), filtros as never, d.get("avisar") === "1");
  });
  redirect(r.erro ? `${volta}&erro=${encodeURIComponent(r.erro)}` : `${volta}&salva=1`);
}

export async function removerPesquisaAcao(d: FormData) {
  await executar(async () => {
    await (await contexto()).servicos.removerPesquisa(texto(d, "id"));
  });
  redirect(`/pesquisar?${texto(d, "volta")}`);
}

export async function criarChaveApiAcao(_: Resultado, d: FormData): Promise<Resultado> {
  return executar(async () => {
    const chave = await (await contexto()).servicos.criarChaveApi(texto(d, "nome"));
    return { ok: "Chave criada. Copie agora: ela não será mostrada de novo.", chave };
  }, "/configuracoes");
}

export async function revogarChaveApiAcao(d: FormData) {
  await executar(async () => {
    await (await contexto()).servicos.revogarChaveApi(texto(d, "id"));
  }, "/configuracoes");
}
