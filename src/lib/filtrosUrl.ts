/** Filtros da pesquisa de empresas ↔ parâmetros da URL de /pesquisar (sem dependência de servidor). */
export interface FiltrosUrl {
  nome?: string; termos?: string; uf?: string; cidade?: string; bairro?: string; segmento?: string;
  setores?: string[]; porte?: string[]; abertura?: string; comEmail?: boolean; comTelefone?: boolean;
  ordem?: "nome" | "recentes" | "aderencia"; incluirFiliais?: boolean;
}

export function paraParametros(f: FiltrosUrl): string {
  const q = new URLSearchParams();
  for (const c of ["nome", "termos", "uf", "cidade", "bairro", "segmento", "abertura"] as const) if (f[c]) q.set(c, f[c]!);
  for (const x of f.setores ?? []) q.append("setor", x);
  for (const x of f.porte ?? []) q.append("porte", x);
  if (f.comEmail) q.set("email", "1");
  if (f.comTelefone) q.set("telefone", "1");
  if (f.ordem === "recentes" || f.ordem === "aderencia") q.set("ordem", f.ordem);
  if (f.incluirFiliais) q.set("filiais", "1");
  return q.toString();
}

const CHAVES_TEXTO = ["nome", "termos", "uf", "cidade", "bairro", "segmento", "abertura"] as const;

/** Guarda só os campos conhecidos e com o tipo certo (o que vem do banco ou do cliente nunca é confiável). */
export function limparFiltros(bruto: unknown): FiltrosUrl {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const f: FiltrosUrl = {};
  for (const c of CHAVES_TEXTO) if (typeof r[c] === "string" && r[c].trim()) f[c] = r[c].trim().slice(0, 120);
  for (const c of ["setores", "porte"] as const) {
    const v = r[c];
    if (Array.isArray(v)) {
      const itens = v.filter((x): x is string => typeof x === "string").slice(0, 30);
      if (itens.length) f[c] = itens;
    }
  }
  if (r.comEmail === true) f.comEmail = true;
  if (r.comTelefone === true) f.comTelefone = true;
  if (r.ordem === "recentes" || r.ordem === "aderencia") f.ordem = r.ordem;
  if (r.incluirFiliais === true) f.incluirFiliais = true;
  return f;
}

/** Descrição curta e legível dos filtros, para listas e e-mails. */
export function resumoFiltros(f: FiltrosUrl): string {
  const partes = [
    f.nome, f.termos, f.segmento, f.bairro, f.cidade, f.uf,
    f.setores?.length ? `${f.setores.length} setor(es)` : "", f.porte?.join("/"),
    f.abertura ? `abertura ${f.abertura}` : "", f.comEmail ? "com e-mail" : "", f.comTelefone ? "com telefone" : "",
  ].filter(Boolean);
  return partes.join(" · ") || "sem filtros";
}
