import type { Noticia } from "./tipos";

/**
 * Notícias recentes pelo feed RSS público do Google Notícias (últimos 30 dias, em português).
 * Busca pelo nome entre aspas; pode trazer homônimos, por isso a tela avisa. Só guardamos título, fonte, data e link.
 */
const entidades: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };
const decodificar = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => entidades[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .trim();
const tag = (item: string, nome: string) => item.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`))?.[1];

export function lerFeed(xml: string, limite = 6): Noticia[] {
  const itens = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const vistos = new Set<string>();
  const saida: Noticia[] = [];
  for (const it of itens) {
    const bruto = decodificar(tag(it, "title") ?? "");
    const fonte = decodificar(tag(it, "source") ?? "") || undefined;
    const url = decodificar(tag(it, "link") ?? "");
    if (!bruto || !/^https:\/\//.test(url)) continue;
    // O Google acrescenta " - Fonte" ao título.
    const titulo = fonte && bruto.endsWith(` - ${fonte}`) ? bruto.slice(0, -(fonte.length + 3)) : bruto;
    const chave = titulo.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const data = tag(it, "pubDate");
    const t = data ? Date.parse(decodificar(data)) : NaN;
    saida.push({ titulo, fonte, url, publicadaEm: Number.isNaN(t) ? undefined : new Date(t).toISOString() });
    if (saida.length >= limite) break;
  }
  return saida;
}

export async function buscarNoticias(termo: string, http: typeof fetch = fetch): Promise<Noticia[]> {
  const q = encodeURIComponent(`"${termo.replace(/"/g, " ")}" when:30d`);
  const r = await http(`https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`, {
    headers: { "User-Agent": "ConectaB2B/0.1" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Notícias: HTTP ${r.status}`);
  return lerFeed(await r.text());
}
