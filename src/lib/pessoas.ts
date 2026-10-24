import type { Contato } from "./providers/types";

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "dr", "dra", "sr", "sra", "jr", "junior", "filho", "neto"]);

/** Nome sem acento, minúsculo e sem partículas: ["maria", "silva"]. */
export function tokensDoNome(nome: string): string[] {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z\s]/g, " ").split(/\s+/)
    .filter((t) => t.length > 0 && !PARTICULAS.has(t));
}

/** Chave para reconhecer a mesma pessoa em fontes diferentes: primeiro e último nome. */
export function chaveDaPessoa(nome: string): string | null {
  const t = tokensDoNome(nome);
  if (t.length < 2) return null;
  return `${t[0]} ${t[t.length - 1]}`;
}

/**
 * Duas grafias são da mesma pessoa quando primeiro e último nome batem e os nomes do meio não se contradizem
 * ("João Pedro Silva" e "João Paulo Silva" são pessoas diferentes; "João Silva" e "João Pedro Silva" podem ser a mesma).
 * Uma inicial ("João P. Silva") combina com o nome do meio que começa por ela.
 */
export function mesmaPessoa(a: string, b: string): boolean {
  const ta = tokensDoNome(a);
  const tb = tokensDoNome(b);
  if (ta.length < 2 || tb.length < 2) return false;
  if (ta[0] !== tb[0] || ta[ta.length - 1] !== tb[tb.length - 1]) return false;
  const [curto, longo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const meioLongo = longo.slice(1, -1);
  return curto.slice(1, -1).every((m) => meioLongo.some((l) => l === m || (m.length === 1 && l.startsWith(m)) || (l.length === 1 && m.startsWith(l))));
}

const PALAVRAS_DE_EMPRESA = new Set([
  "ltda", "eireli", "epp", "holding", "participacoes", "administracao", "administradora", "fundo", "fundacao", "associacao", "cooperativa",
  "empreendimentos", "investimentos", "incorporadora", "companhia", "sociedade", "instituto", "banco", "comercio", "industria", "servicos", "cia", "seguradora", "consorcio",
]);

/** Verdadeiro quando o nome parece de empresa (sócio pessoa jurídica) e não de pessoa. */
export function pareceEmpresa(nome: string): boolean {
  if (/\bS\.?\/?A\.?(\s|$)/.test(nome) || /\d{3,}/.test(nome)) return true; // S.A., S/A (maiúsculo: "SÁ" é sobrenome) ou número
  return tokensDoNome(nome).some((t) => PALAVRAS_DE_EMPRESA.has(t));
}

/** "MARIA DA SILVA" -> "Maria da Silva". Nomes que já têm minúsculas ficam como estão. */
export function formatarNome(nome: string): string {
  const n = nome.trim().replace(/\s+/g, " ");
  if (n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p.normalize("NFD").replace(/[̀-ͯ]/g, "")) && !/^(jr|junior|filho|neto)$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

const GENERICO = /^(caixa|contato|comercial|vendas|marketing|financeiro|rh|atendimento|sac|ouvidoria|imprensa|compras)\b/i;

/**
 * Junta contatos que são a mesma pessoa. Fica com o cargo mais específico (o que não é só "pessoa citada"),
 * soma dados que faltam (e-mail, telefone, LinkedIn) e sobe a confiança quando duas fontes diferentes concordam.
 */
export function unirPessoas(contatos: Contato[]): Contato[] {
  const grupos: Contato[][] = [];
  const avulsos: Contato[] = [];
  for (const c of contatos) {
    if (GENERICO.test(c.nome) || tokensDoNome(c.nome).length < 2) { avulsos.push(c); continue; }
    const g = grupos.find((x) => x.some((y) => mesmaPessoa(y.nome, c.nome)));
    if (g) g.push(c); else grupos.push([c]);
  }
  const unidos = grupos.map((g) => {
    if (g.length === 1) return g[0];
    const base = [...g].sort((a, b) => b.confianca - a.confianca)[0];
    const especifico = g.find((c) => !/pessoa citada/i.test(c.cargo)) ?? base;
    const origens = [...new Set(g.flatMap((c) => c.origem.split(" + ")))];
    const fontes = new Set(g.map((c) => c.origem.split(" — ")[0].split(" (")[0])).size;
    return {
      ...base,
      nome: formatarNome(g.reduce((m, c) => (tokensDoNome(c.nome).length > tokensDoNome(m).length ? c.nome : m), base.nome)),
      cargo: especifico.cargo,
      senioridade: base.senioridade ?? g.find((c) => c.senioridade)?.senioridade,
      departamento: base.departamento ?? g.find((c) => c.departamento)?.departamento,
      email: base.email ?? g.find((c) => c.email)?.email,
      emailStatus: base.email ? base.emailStatus : g.find((c) => c.email)?.emailStatus,
      telefone: base.telefone ?? g.find((c) => c.telefone)?.telefone,
      linkedinUrl: base.linkedinUrl ?? g.find((c) => c.linkedinUrl)?.linkedinUrl,
      origem: origens.join(" + "),
      confianca: Math.min(0.95, base.confianca + 0.15 * (fontes - 1)),
    } satisfies Contato;
  });
  return [...unidos, ...avulsos];
}

type Padrao = (p: string[]) => string;
const PADROES: Record<string, Padrao> = {
  "{nome}.{sobrenome}": (p) => `${p[0]}.${p[p.length - 1]}`,
  "{n}{sobrenome}": (p) => `${p[0][0]}${p[p.length - 1]}`,
  "{nome}": (p) => p[0],
  "{nome}{sobrenome}": (p) => `${p[0]}${p[p.length - 1]}`,
  "{n}.{sobrenome}": (p) => `${p[0][0]}.${p[p.length - 1]}`,
  "{sobrenome}": (p) => p[p.length - 1],
  "{nome}_{sobrenome}": (p) => `${p[0]}_${p[p.length - 1]}`,
};

/** Descobre o padrão de e-mail da empresa a partir de e-mails de pessoas conhecidas no domínio. */
export function descobrirPadrao(contatos: Contato[], dominio: string): string | null {
  const votos = new Map<string, number>();
  for (const c of contatos) {
    if (!c.email?.endsWith(`@${dominio}`)) continue;
    const t = tokensDoNome(c.nome);
    if (t.length < 2) continue;
    const local = c.email.split("@")[0];
    for (const [nome, f] of Object.entries(PADROES)) if (f(t) === local) votos.set(nome, (votos.get(nome) ?? 0) + 1);
  }
  return [...votos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Preenche, como palpite, o e-mail de quem não tem, usando o padrão da empresa. Nunca sobrescreve e-mail existente. */
export function inferirEmails(contatos: Contato[], dominio: string | undefined): Contato[] {
  if (!dominio) return contatos;
  const padrao = descobrirPadrao(contatos, dominio);
  if (!padrao) return contatos;
  return contatos.map((c) => {
    const t = tokensDoNome(c.nome);
    if (c.email || t.length < 2 || GENERICO.test(c.nome)) return c;
    return {
      ...c,
      email: `${PADROES[padrao](t)}@${dominio}`,
      emailStatus: "inferido" as const,
      confianca: Math.max(0.2, c.confianca * 0.9),
      origem: `${c.origem} + e-mail inferido pelo padrão ${padrao}@${dominio}`,
    };
  });
}
