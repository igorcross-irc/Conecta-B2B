import { lookup as dnsLookup } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";

/** Extrai o IPv4 embutido em um endereço IPv6 mapeado (::ffff:a.b.c.d ou ::ffff:aabb:ccdd), se houver. */
function v4Embutido(l: string): string | null {
  const m = l.match(/^(?:::ffff:|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16);
  const lo = parseInt(m[3], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** Endereços que nunca devem ser acessados a partir do servidor (rede interna, loopback, metadados, reservados). */
export function enderecoPrivado(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    const v4 = v4Embutido(l);
    if (v4) return enderecoPrivado(v4);
    return (
      l === "::1" || l === "::" ||
      l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") ||
      l.startsWith("fea") || l.startsWith("feb") || l.startsWith("ff") ||
      l.startsWith("::ffff:") || l.startsWith("64:ff9b:") || l.startsWith("2002:") || l.startsWith("2001:db8")
    );
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/**
 * Resolve o nome já validando o endereço. Usado como `lookup` da conexão: o IP que passou na validação
 * é exatamente o IP ao qual o socket se conecta, o que elimina a troca de IP entre a checagem e o acesso
 * (DNS rebinding).
 */
export const lookupSeguro: typeof dnsLookup = ((host: string, opcoes: unknown, cb?: unknown) => {
  const callback = (typeof opcoes === "function" ? opcoes : cb) as (e: Error | null, a?: unknown, f?: number) => void;
  const todos = typeof opcoes === "object" && opcoes !== null && (opcoes as { all?: boolean }).all === true;
  dnsLookup(host, { all: true }, (erro, enderecos) => {
    if (erro) return callback(erro);
    const lista = enderecos as { address: string; family: number }[];
    if (!lista.length || lista.some((a) => enderecoPrivado(a.address))) {
      return callback(new Error("Endereço não permitido."));
    }
    if (todos) return callback(null, lista);
    callback(null, lista[0].address, lista[0].family);
  });
}) as typeof dnsLookup;

export interface OpcoesFetchSeguro {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Para a leitura depois deste tanto de bytes (evita baixar arquivos enormes). */
  maxBytes?: number;
}

/**
 * GET por HTTPS que só se conecta a endereços públicos (valida no momento da conexão) e não segue redirecionamentos.
 * Devolve um Response, para ser intercambiável com `fetch` nos pontos que só leem status, cabeçalhos e texto.
 */
export function fetchSeguro(url: string, opcoes: OpcoesFetchSeguro = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const alvo = new URL(url);
    if (alvo.protocol !== "https:" || isIP(alvo.hostname)) return reject(new Error("Só HTTPS por nome é permitido."));
    const max = opcoes.maxBytes ?? 500_000;
    const req = request(
      alvo,
      { method: "GET", headers: opcoes.headers, lookup: lookupSeguro, signal: opcoes.signal },
      (res) => {
        const pedacos: Buffer[] = [];
        let total = 0;
        const fim = () => {
          const cabecalhos = new Headers();
          for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) cabecalhos.set(k, [v].flat().join(", "));
          const status = res.statusCode ?? 0;
          const corpo = status === 204 || status === 304 || (status >= 100 && status < 200) ? null : Buffer.concat(pedacos);
          resolve(new Response(corpo, { status, headers: cabecalhos }));
        };
        res.on("data", (b: Buffer) => {
          pedacos.push(b);
          total += b.length;
          if (total >= max) {
            res.destroy();
            fim();
          }
        });
        res.on("end", fim);
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}
