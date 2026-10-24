import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { enderecoPrivado, fetchSeguro } from "../httpSeguro";
import { cnpjValido, somenteDigitos } from "../cnpj";
import type { Contato, EntradaBuscaContatos, ProvedorContatos } from "./types";

/**
 * Fonte gratuita de contato: lê páginas públicas do site da empresa (início, contato, sobre, equipe)
 * e extrai e-mails do próprio domínio e telefones. Sem IA: só padrões de texto.
 * Regras: respeita robots.txt, identifica-se no User-Agent, poucas páginas, nunca acessa rede interna.
 * O dado é defasado e de precisão média; entra como "não verificado" e com a origem registrada.
 */

const AGENTE = "ConectaB2B-Bot/0.1 (coleta de contato profissional publicado no site; opt-out em /optout)";
const CAMINHOS = ["/", "/contato", "/fale-conosco", "/sobre", "/quem-somos", "/equipe"];
const CAMINHOS_CNPJ = ["/", "/contato", "/fale-conosco", "/sobre", "/quem-somos", "/politica-de-privacidade", "/privacidade", "/termos-de-uso", "/termos"];
const MAX_BYTES = 500_000;
const PRAZO_MS = 8_000;
/** Prazo somando todas as páginas de um site, e quantas baixam ao mesmo tempo. */
const PRAZO_TOTAL_MS = 20_000;
const SIMULTANEAS = 3;

/** Prefixos de caixa genérica da empresa, em ordem de utilidade comercial. */
const CAIXAS_COMERCIAIS = /^(comercial|vendas|contato|marketing|atendimento|sac|compras|diretoria|relacionamento)$/i;

export { enderecoPrivado };

/** Cliente padrão: só conecta a endereços públicos, validados no momento da conexão (sem DNS rebinding). */
const httpSeguro = ((url: string, init?: RequestInit) =>
  fetchSeguro(url, {
    headers: init?.headers as Record<string, string> | undefined,
    signal: init?.signal ?? undefined,
    maxBytes: MAX_BYTES,
  })) as unknown as typeof fetch;

export type Resolvedor = (host: string) => Promise<string[]>;

const resolverDns: Resolvedor = async (host) =>
  (await dns.lookup(host, { all: true })).map((a) => a.address);

export function dominioSeguro(d: string): string | null {
  const limpo = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(limpo)) return null;
  if (isIP(limpo)) return null;
  return limpo;
}

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const RE_TEL = /\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;

const RE_CNPJ = /(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?!\d)|CNPJ[^0-9]{0,15}(\d{14})(?!\d)/gi;

/** CNPJs com dígitos verificadores válidos que aparecem no texto da página (sem repetir). */
export function extrairCnpjs(html: string): string[] {
  const texto = textoVisivel(html);
  const achados = new Set<string>();
  for (const m of texto.matchAll(RE_CNPJ)) {
    const d = somenteDigitos(m[1] ?? m[0]);
    if (cnpjValido(d)) achados.add(d);
  }
  return [...achados];
}

function textoVisivel(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function decodificaCloudflare(html: string): string {
  // Sites protegidos pelo Cloudflare escondem e-mails em data-cfemail (XOR com a primeira chave).
  return html.replace(/data-cfemail="([0-9a-f]+)"/gi, (_m, hex: string) => {
    const k = parseInt(hex.slice(0, 2), 16);
    let s = "";
    for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
    return ` ${s} `;
  });
}

export function extrairEmails(html: string, dominio: string): string[] {
  const fonte = decodificaCloudflare(html).replace(/\[at\]|\(at\)| arroba /gi, "@");
  const achados = new Set<string>();
  for (const m of fonte.matchAll(RE_EMAIL)) {
    const e = m[0].toLowerCase().replace(/\.+$/, "");
    const d = e.split("@")[1];
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e)) continue;
    if (d === dominio || d.endsWith(`.${dominio}`)) achados.add(e);
  }
  return [...achados];
}

export function extrairTelefones(html: string): string[] {
  const achados = new Set<string>();
  for (const m of textoVisivel(html).matchAll(RE_TEL)) {
    const d = m[0].replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) achados.add(`(${d.slice(0, 2)}) ${d.slice(2)}`);
  }
  return [...achados];
}

/** Permite o acesso se o robots.txt não bloquear o caminho para nós nem para "*". */
export function permitidoPorRobots(robots: string, caminho: string): boolean {
  let aplica = false;
  const bloqueios: string[] = [];
  const liberacoes: string[] = [];
  for (const linha of robots.split(/\r?\n/)) {
    const [chave, ...resto] = linha.split("#")[0].split(":");
    const valor = resto.join(":").trim();
    const k = chave.trim().toLowerCase();
    if (k === "user-agent") aplica = valor === "*" || /conectab2b/i.test(valor);
    else if (aplica && k === "disallow" && valor) bloqueios.push(valor);
    else if (aplica && k === "allow" && valor) liberacoes.push(valor);
  }
  const maior = (lista: string[]) =>
    Math.max(-1, ...lista.filter((p) => caminho.startsWith(p.replace(/\*.*$/, ""))).map((p) => p.length));
  return maior(bloqueios) <= maior(liberacoes) || maior(bloqueios) === -1;
}

interface Dependencias {
  http?: typeof fetch;
  resolver?: Resolvedor;
}

export class SiteEmpresa implements ProvedorContatos {
  nome = "Site da empresa (páginas públicas)";
  private http: typeof fetch;
  private resolver: Resolvedor;

  constructor({ http = httpSeguro, resolver = resolverDns }: Dependencias = {}) {
    this.http = http;
    this.resolver = resolver;
  }

  private async baixar(host: string, caminho: string, saltos = 0): Promise<string | null> {
    const ips = await this.resolver(host).catch(() => []);
    if (!ips.length || ips.some(enderecoPrivado)) return null;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), PRAZO_MS);
    try {
      // Redirecionamento manual: só dentro do mesmo site (com ou sem www), para não sair para outro lugar.
      const res = await this.http(`https://${host}${caminho}`, {
        headers: { "User-Agent": AGENTE, Accept: "text/html,text/plain" },
        redirect: "manual",
        signal: ctl.signal,
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400 && saltos < 2) {
        const destino = new URL(res.headers.get("location") ?? "", `https://${host}${caminho}`);
        const semWww = (h: string) => h.replace(/^www\./, "");
        if (destino.protocol === "https:" && semWww(destino.hostname) === semWww(host)) {
          return await this.baixar(destino.hostname, destino.pathname + destino.search, saltos + 1);
        }
        return null;
      }
      if (!res.ok || !/text\/(html|plain)/.test(res.headers.get("content-type") ?? "text/plain")) return null;
      return (await res.text()).slice(0, MAX_BYTES);
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Baixa vários caminhos do mesmo host, poucos por vez e com um prazo total, para uma busca não
   * ocupar o tempo da rota. Respeita o robots.txt. Devolve só as páginas que vieram.
   */
  private async baixarVarias(host: string, caminhos: string[], robots: string): Promise<string[]> {
    const limite = Date.now() + PRAZO_TOTAL_MS;
    const fila = caminhos.filter((c) => !robots || permitidoPorRobots(robots, c));
    const paginas: string[] = [];
    const trabalhador = async () => {
      for (let c = fila.shift(); c !== undefined; c = fila.shift()) {
        if (Date.now() > limite) return;
        const html = await this.baixar(host, c);
        if (html) paginas.push(html);
      }
    };
    await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhador));
    return paginas;
  }

  /**
   * Procura CNPJs publicados no site (rodapé, contato, política de privacidade e termos).
   * Devolve os CNPJs válidos em ordem de quantas vezes aparecem. Respeita robots.txt.
   */
  async descobrirCnpjs(dominioInformado: string): Promise<{ cnpj: string; ocorrencias: number }[]> {
    const dominio = dominioSeguro(dominioInformado)?.replace(/^www\./, "");
    if (!dominio) return [];
    const contagem = new Map<string, number>();
    for (const host of [`www.${dominio}`, dominio]) {
      const robots = (await this.baixar(host, "/robots.txt")) ?? "";
      for (const html of await this.baixarVarias(host, CAMINHOS_CNPJ, robots)) {
        for (const c of extrairCnpjs(html)) contagem.set(c, (contagem.get(c) ?? 0) + 1);
      }
      if (contagem.size) break;
    }
    return [...contagem].map(([cnpj, ocorrencias]) => ({ cnpj, ocorrencias })).sort((a, b) => b.ocorrencias - a.ocorrencias);
  }

  async buscar({ empresa }: EntradaBuscaContatos): Promise<Contato[]> {
    const dominio = empresa.dominio ? dominioSeguro(empresa.dominio) : null;
    if (!dominio) return [];
    const host = dominio.startsWith("www.") ? dominio : `www.${dominio}`;

    const robots = (await this.baixar(host, "/robots.txt")) ?? "";
    const emails = new Set<string>();
    const telefones = new Set<string>();
    const paginas = await this.baixarVarias(host, CAMINHOS, robots);
    for (const html of paginas) {
      extrairEmails(html, dominio).forEach((e) => emails.add(e));
      extrairTelefones(html).forEach((t) => telefones.add(t));
    }

    const agora = new Date().toISOString();
    const origem = `Site ${dominio} (página pública)`;
    const contatos: Contato[] = [];
    for (const e of emails) {
      const local = e.split("@")[0];
      const generica = CAIXAS_COMERCIAIS.test(local);
      contatos.push({
        nome: generica ? `Caixa ${local} (${dominio})` : local.replace(/[._-]+/g, " "),
        cargo: generica ? "Caixa genérica da empresa" : "Pessoa citada no site",
        departamento: generica ? local : undefined,
        email: e,
        emailStatus: "nao_verificado",
        origem,
        obtidoEm: agora,
        // Caixa genérica publicada pela própria empresa é confiável como canal; pessoa por e-mail é palpite.
        confianca: generica ? 0.55 : 0.35,
        ...(telefones.size && generica ? { telefone: [...telefones][0] } : {}),
      });
    }
    return contatos;
  }
}
