import { classificarCargo } from "../cargos";
import { gerarJson, listarModelos, escolherModelo } from "../ia/gemini";
import { tokensDoNome } from "../pessoas";
import type { Contato, EntradaBuscaContatos, ProvedorContatos } from "./types";

/**
 * Descoberta de pessoas por busca na web + IA.
 * 1) Tavily (busca; chave em TAVILY_API_KEY) acha páginas públicas que citam decisores da empresa
 *    (sites, notícias, perfis públicos indexados em buscadores).
 * 2) Gemini lê só os trechos devolvidos pela busca e extrai nome, cargo e a página de origem.
 * Proteções contra invenção: a pessoa só vale se o nome aparece, por escrito, no trecho da página citada;
 * cada contato guarda o endereço da página de origem; a confiança é baixa até outra fonte concordar.
 * Não acessa o LinkedIn diretamente: usa apenas o que o buscador já indexou.
 */
interface ResultadoTavily { title?: string; url?: string; content?: string }
interface Extraido { pessoas?: { nome?: string; cargo?: string; trecho?: string; url?: string }[] }

export function consultasDeBusca(nome: string, cidade?: string): string[] {
  const local = cidade ? ` ${cidade}` : "";
  return [
    `"${nome}"${local} diretor OR gerente OR sócio OR proprietário OR CEO OR "head" site:linkedin.com/in`,
    `"${nome}"${local} diretor comercial OR marketing OR "gerente comercial" OR "diretor executivo"`,
  ];
}

/** Só aceita nomes que aparecem escritos no trecho da fonte (primeiro e último nome). */
export function nomeApareceNoTexto(nome: string, texto: string): boolean {
  const t = tokensDoNome(nome);
  if (t.length < 2) return false;
  const base = tokensDoNome(texto);
  return base.includes(t[0]) && base.includes(t[t.length - 1]);
}

export class BuscaWebPessoas implements ProvedorContatos {
  nome = "Busca na web + IA (páginas públicas)";
  constructor(
    private chaveBusca: string,
    private chaveIa: string,
    private modeloIa?: string,
    private http: typeof fetch = fetch,
  ) {}

  private async buscarWeb(consulta: string): Promise<ResultadoTavily[]> {
    const r = await this.http("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.chaveBusca}` },
      body: JSON.stringify({ query: consulta, search_depth: "basic", max_results: 8, include_answer: false }),
      signal: AbortSignal.timeout(25000),
    });
    if (r.status === 401) throw new Error("Tavily: chave inválida.");
    if (r.status === 429 || r.status === 432 || r.status === 433) throw new Error("Tavily: limite do plano atingido.");
    if (!r.ok) throw new Error(`Tavily: HTTP ${r.status}`);
    return ((await r.json()) as { results?: ResultadoTavily[] }).results ?? [];
  }

  async buscar({ empresa }: EntradaBuscaContatos): Promise<Contato[]> {
    const nome = empresa.nomeFantasia && !empresa.nomeFantasia.includes(".") ? empresa.nomeFantasia : empresa.razaoSocial;
    const resultados = (await Promise.all(consultasDeBusca(nome, empresa.municipio).map((q) => this.buscarWeb(q).catch(() => []))))
      .flat()
      .filter((x) => x.url && x.content);
    const unicos = [...new Map(resultados.map((x) => [x.url!, x])).values()].slice(0, 12);
    if (unicos.length === 0) return [];

    const modelo = this.modeloIa ?? escolherModelo(await listarModelos(this.chaveIa, this.http));
    if (!modelo) return [];
    const fontes = unicos.map((x, i) => `[${i}] ${x.url}\n${x.title ?? ""}\n${(x.content ?? "").slice(0, 700)}`).join("\n\n");
    const prompt = `Você extrai pessoas de trechos de páginas da web. Empresa alvo: "${empresa.razaoSocial}"${empresa.nomeFantasia ? ` (nome fantasia "${empresa.nomeFantasia}")` : ""}${empresa.municipio ? `, ${empresa.municipio}/${empresa.uf ?? ""}` : ""}.
Liste SOMENTE pessoas que, segundo o próprio trecho, trabalham ou são sócias dessa empresa (não de outra com nome parecido), com cargo de decisão (sócio, diretor, gerente, head, CEO, proprietário, coordenador). Não invente nada: use apenas o que está escrito. Para cada pessoa, copie em "trecho" a frase exata onde o nome aparece e em "url" o endereço da fonte.
Responda em JSON: {"pessoas":[{"nome":"","cargo":"","trecho":"","url":""}]}. Se não houver ninguém, {"pessoas":[]}.

${fontes}`;
    const extraido = await gerarJson<Extraido>(this.chaveIa, modelo, prompt, this.http);
    const agora = new Date().toISOString();
    const vistos = new Set<string>();
    const contatos: Contato[] = [];
    for (const p of extraido?.pessoas ?? []) {
      if (!p.nome || !p.cargo || !p.url) continue;
      const fonte = unicos.find((x) => x.url === p.url);
      if (!fonte || !nomeApareceNoTexto(p.nome, `${fonte.title ?? ""} ${fonte.content ?? ""}`)) continue;
      const k = p.nome.toLowerCase();
      if (vistos.has(k)) continue;
      vistos.add(k);
      const linkedin = /linkedin\.com\/in\//.test(p.url) ? p.url : undefined;
      const c = classificarCargo(p.cargo);
      contatos.push({
        nome: p.nome.trim(),
        cargo: p.cargo.trim(),
        senioridade: c.senioridade,
        departamento: c.departamento,
        linkedinUrl: linkedin,
        origem: `Busca na web: ${p.url}`,
        obtidoEm: agora,
        confianca: 0.4,
      });
    }
    return contatos;
  }
}
