import { promises as dns } from "node:dns";
import type { Contato } from "./types";

/**
 * Verificação gratuita de e-mail pelo domínio: se o domínio não tem servidor de e-mail (MX) nem endereço (A/AAAA),
 * o e-mail não pode funcionar e é descartado; se tem, o status sobe de "não verificado" para "domínio recebe e-mail".
 * Isso NÃO confirma que a caixa existe (para isso é preciso um verificador SMTP pago) e por isso não vira "verificado".
 * Falha de rede ou DNS indefinido deixa o e-mail como está.
 */
export type ResolvedorMx = (dominio: string) => Promise<"recebe" | "nao_recebe" | "indefinido">;

const DEFINITIVOS = new Set(["ENOTFOUND", "ENODATA"]);

const consulta: ResolvedorMx = async (dominio) => {
  try {
    const mx = await dns.resolveMx(dominio);
    if (mx.some((m) => m.exchange && m.exchange !== ".")) return "recebe";
    return "nao_recebe";
  } catch (e) {
    const codigo = (e as { code?: string }).code ?? "";
    if (!DEFINITIVOS.has(codigo)) return "indefinido";
  }
  // Sem MX: o padrão SMTP aceita o próprio endereço do domínio (registro A/AAAA) como destino.
  for (const f of [dns.resolve4, dns.resolve6]) {
    try {
      if ((await f(dominio)).length) return "recebe";
    } catch (e) {
      if (!DEFINITIVOS.has((e as { code?: string }).code ?? "")) return "indefinido";
    }
  }
  return "nao_recebe";
};

/**
 * Trava de segurança: antes de acreditar em "não recebe", confirma que o DNS do ambiente funciona perguntando por um domínio
 * que certamente tem e-mail. Se o DNS estiver quebrado (ex.: ambiente sem resolvedor), ninguém é descartado por engano.
 */
let canario: Promise<boolean> | undefined;
const dnsFunciona = () => (canario ??= consulta("gmail.com").then((r) => r === "recebe"));

export const resolverMx: ResolvedorMx = async (dominio) => {
  const r = await consulta(dominio);
  if (r === "nao_recebe" && !(await dnsFunciona())) return "indefinido";
  return r;
};

const memo = new Map<string, { ate: number; r: Awaited<ReturnType<ResolvedorMx>> }>();

export async function verificarDominiosDeEmail(
  contatos: Contato[],
  resolverEscolhido?: ResolvedorMx,
  agora: () => number = Date.now,
): Promise<Contato[]> {
  // Com o resolvedor padrão, fica desligada nos testes e no modo demonstração (os domínios dali são fictícios e seriam todos descartados).
  if (!resolverEscolhido && (process.env.CONECTA_SEM_MX === "1" || process.env.CONECTA_MODO_DEMO === "1")) return contatos;
  const resolver = resolverEscolhido ?? resolverMx;
  const dominios = [...new Set(contatos.flatMap((c) => (c.email ? [c.email.split("@")[1]?.toLowerCase()] : [])).filter((d): d is string => Boolean(d)))];
  const resultado = new Map<string, Awaited<ReturnType<ResolvedorMx>>>();
  await Promise.all(
    dominios.map(async (d) => {
      const m = memo.get(d);
      if (m && m.ate > agora()) return void resultado.set(d, m.r);
      const r = await resolver(d).catch(() => "indefinido" as const);
      if (r !== "indefinido") memo.set(d, { ate: agora() + 6 * 3_600_000, r });
      resultado.set(d, r);
    }),
  );
  return contatos.map((c) => {
    const d = c.email?.split("@")[1]?.toLowerCase();
    const r = d ? resultado.get(d) : undefined;
    if (!c.email || !r || r === "indefinido") return c;
    if (r === "nao_recebe") {
      const { email: _descartado, emailStatus: _status, ...resto } = c;
      void _descartado;
      void _status;
      return resto;
    }
    return c.emailStatus === "nao_verificado" ? { ...c, emailStatus: "dominio_ok" as const } : c;
  });
}
