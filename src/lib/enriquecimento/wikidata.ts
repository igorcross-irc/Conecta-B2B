import { somenteDigitos } from "../cnpj";
import type { InfoWikidata } from "./tipos";

/**
 * Wikidata (dado aberto, CC0): número de funcionários, receita, fundação, site e LinkedIn de empresas conhecidas.
 * Só cobre empresas notáveis e os valores podem ser antigos (mostramos o ano). Para não confundir homônimos, só aceita
 * a entidade se o CNPJ (P6204) ou o site (P856) coincidirem com o que já sabemos da empresa.
 */
const API = "https://www.wikidata.org/w/api.php";
const UA = { "User-Agent": "ConectaB2B/0.1 (enriquecimento de empresas; opt-out em /optout)" };

interface Snak { datavalue?: { value: unknown } }
interface Afirmacao { mainsnak: Snak; rank?: string; qualifiers?: Record<string, Snak[]> }
interface Entidade { id: string; labels?: Record<string, { value: string } | undefined>; claims?: Record<string, Afirmacao[]> }

const MOEDAS: Record<string, "USD" | "BRL" | "EUR"> = { Q4917: "USD", Q25224: "BRL", Q4916: "EUR" };

const valor = (a: Afirmacao) => a.mainsnak.datavalue?.value;
const anoDe = (a: Afirmacao): number | undefined => {
  const t = (a.qualifiers?.P585?.[0]?.datavalue?.value as { time?: string } | undefined)?.time;
  const m = t?.match(/^\+(\d{4})/);
  return m ? Number(m[1]) : undefined;
};
const vigentes = (l: Afirmacao[] = []) => (l.some((a) => a.rank === "preferred") ? l.filter((a) => a.rank === "preferred") : l.filter((a) => a.rank !== "deprecated"));
/** O dado mais recente (maior ano de referência; sem ano, vale o último da lista). */
const maisRecente = (l: Afirmacao[] = []) => vigentes(l).reduce<Afirmacao | undefined>((m, a) => (!m || (anoDe(a) ?? 0) >= (anoDe(m) ?? 0) ? a : m), undefined);
const hostDe = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/** Confere se a entidade é a empresa: mesmo CNPJ ou mesmo domínio de site. */
export function entidadeEhDaEmpresa(e: Entidade, cnpj: string, dominio?: string): boolean {
  const alvo = somenteDigitos(cnpj);
  const cnpjs = (e.claims?.P6204 ?? []).map((a) => somenteDigitos(String(valor(a) ?? "")));
  if (alvo && cnpjs.includes(alvo)) return true;
  const d = (dominio ?? "").replace(/^www\./, "").toLowerCase();
  if (!d) return false;
  return (e.claims?.P856 ?? []).some((a) => {
    const h = hostDe(String(valor(a) ?? ""));
    return h === d || h.endsWith(`.${d}`);
  });
}

export function extrairWikidata(e: Entidade): InfoWikidata {
  const c = e.claims ?? {};
  const emp = maisRecente(c.P1128);
  const rec = maisRecente(c.P2139);
  const recV = rec ? (valor(rec) as { amount?: string; unit?: string } | undefined) : undefined;
  const moeda = recV?.unit ? MOEDAS[recV.unit.split("/").pop() ?? ""] : undefined;
  const fund = (valor(c.P571?.[0] ?? { mainsnak: {} }) as { time?: string } | undefined)?.time?.match(/^\+(\d{4})/);
  const site = c.P856?.map((a) => String(valor(a) ?? "")).find(Boolean);
  const li = c.P4264?.map((a) => String(valor(a) ?? "")).find(Boolean);
  return {
    id: e.id,
    url: `https://www.wikidata.org/wiki/${e.id}`,
    nome: e.labels?.pt?.value ?? e.labels?.en?.value,
    funcionarios: emp ? { valor: Math.round(Number((valor(emp) as { amount: string }).amount)), ano: anoDe(emp) } : undefined,
    receita: recV?.amount && moeda ? { valor: Number(recV.amount), moeda, ano: rec ? anoDe(rec) : undefined } : undefined,
    fundadaEm: fund ? Number(fund[1]) : undefined,
    site,
    linkedin: li ? `https://www.linkedin.com/company/${li}` : undefined,
  };
}

export async function buscarWikidata(
  empresa: { cnpj: string; razaoSocial: string; nomeFantasia?: string; dominio?: string },
  http: typeof fetch = fetch,
): Promise<InfoWikidata | null> {
  const nomes = [...new Set([empresa.nomeFantasia, simplificarNome(empresa.razaoSocial)].filter((n): n is string => Boolean(n)))].slice(0, 2);
  const ids = new Set<string>();
  for (const n of nomes) {
    const u = `${API}?action=wbsearchentities&search=${encodeURIComponent(n)}&language=pt&uselang=pt&limit=5&format=json&origin=*`;
    const r = await http(u, { headers: UA, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`Wikidata: HTTP ${r.status}`);
    for (const x of ((await r.json()) as { search?: { id: string }[] }).search ?? []) ids.add(x.id);
  }
  if (!ids.size) return null;
  const u = `${API}?action=wbgetentities&ids=${[...ids].slice(0, 10).join("|")}&props=claims|labels&languages=pt|en&format=json&origin=*`;
  const r = await http(u, { headers: UA, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Wikidata: HTTP ${r.status}`);
  const entidades = Object.values(((await r.json()) as { entities?: Record<string, Entidade> }).entities ?? {});
  const achada = entidades.find((e) => entidadeEhDaEmpresa(e, empresa.cnpj, empresa.dominio));
  return achada ? extrairWikidata(achada) : null;
}

/** "PETROLEO BRASILEIRO S A PETROBRAS" → "PETROLEO BRASILEIRO PETROBRAS"; tira o tipo societário que atrapalha a busca. */
export function simplificarNome(razao: string): string {
  return razao.replace(/\b(LTDA|EIRELI|ME|EPP|S\.?\/?A\.?|S A|SA|CIA|COMPANHIA|MEI)\b\.?/gi, " ").replace(/\s+/g, " ").trim();
}
