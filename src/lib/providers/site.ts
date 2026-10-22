import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import type { Contato, EntradaBuscaContatos, ProvedorContatos } from "./types";

/**
 * Fonte gratuita de contato: lê páginas públicas do site da empresa (início, contato, sobre, equipe)
 * e extrai e-mails do próprio domínio e telefones. Sem IA: só padrões de texto.
 * Regras: respeita robots.txt, identifica-se no User-Agent, poucas páginas, nunca acessa rede interna.
 * O dado é defasado e de precisão média; entra como "não verificado" e com a origem registrada.
 */

const AGENTE = "ConectaB2B-Bot/0.1 (coleta de contato profissional publicado no site; opt-out em /optout)";
const CAMINHOS = ["/", "/contato", "/fale-conosco", "/sobre", "/quem-somos", "/equipe"];
const MAX_BYTES = 500_000;
const PRAZO_MS = 8_000;

/** Prefixos de caixa genérica da empresa, em ordem de utilidade comercial. */
const CAIXAS_COMERCIAIS = /^(comercial|vendas|contato|marketing|atendimento|sac|compras|diretoria|relacionamento)$/i;

export type Resolvedor = (host: string) => Promise<string[]>;

const resolverDns: Resolvedor = async (host) =>
  (await dns.lookup(host, { all: true })).map((a) => a.address);

/** Endereços que nunca devem ser acessados a partir do servidor (rede interna, loopback, metadados). */
export function enderecoPrivado(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export function dominioSeguro(d: string): string | null {
  const limpo = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(limpo)) return null;
  if (isIP(limpo)) return null;
  return limpo;
}

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const RE_TEL = /\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;

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

  constructor({ http = fetch, resolver = resolverDns }: Dependencias = {}) {
    this.http = http;
    this.resolver = resolver;
  }

  private async baixar(host: string, caminho: string): Promise<string | null> {
    const ips = await this.resolver(host).catch(() => []);
    if (!ips.length || ips.some(enderecoPrivado)) return null;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), PRAZO_MS);
    try {
      // Redirecionamento manual: só dentro do mesmo domínio, para não sair para outro lugar.
      const res = await this.http(`https://${host}${caminho}`, {
        headers: { "User-Agent": AGENTE, Accept: "text/html,text/plain" },
        redirect: "manual",
        signal: ctl.signal,
        cache: "no-store",
      });
      if (!res.ok || !/text\/(html|plain)/.test(res.headers.get("content-type") ?? "text/plain")) return null;
      return (await res.text()).slice(0, MAX_BYTES);
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  async buscar({ empresa }: EntradaBuscaContatos): Promise<Contato[]> {
    const dominio = empresa.dominio ? dominioSeguro(empresa.dominio) : null;
    if (!dominio) return [];
    const host = dominio.startsWith("www.") ? dominio : `www.${dominio}`;

    const robots = (await this.baixar(host, "/robots.txt")) ?? "";
    const emails = new Set<string>();
    const telefones = new Set<string>();
    for (const caminho of CAMINHOS) {
      if (robots && !permitidoPorRobots(robots, caminho)) continue;
      const html = await this.baixar(host, caminho);
      if (!html) continue;
      extrairEmails(html, dominio).forEach((e) => emails.add(e));
      extrairTelefones(html).forEach((t) => telefones.add(t));
      if (emails.size >= 8) break;
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
