import { lerCsv } from "../csv";
import { somenteDigitos } from "../cnpj";
import type { Contato } from "../providers/types";
import type { InfoCvm } from "./tipos";

/**
 * Cadastro de companhias abertas da CVM (dados abertos, licença ODbL): empresas listadas, com setor, controle acionário,
 * auditor e o Diretor de Relações com Investidores, que publica e-mail e telefone institucionais.
 * Arquivo único de ~1,5 MB, em Latin-1, separado por ponto e vírgula; guardado em memória por 24 h.
 */
export const URL_CVM = "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv";

type Indice = Map<string, InfoCvm>;

/** "DIRETOR DE RELAÇÕES COM INVESTIDORES" → "Diretor de Relações com Investidores". */
const titulo = (t: string) =>
  t.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && ["de", "da", "do", "com", "e"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ");

const limpar = (v: string | undefined) => (v ?? "").trim();
const emails = (v: string) =>
  [...new Set(v.split(/[\s/;,]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
const telefone = (ddd: string, tel: string) => {
  const d = (ddd + tel).replace(/\D/g, "");
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : undefined;
};

/** Converte o CSV (já em texto) em um índice por CNPJ. Companhias com várias linhas (um mercado cada) ficam com a ativa. */
export function indexarCvm(texto: string): Indice {
  const linhas = lerCsv(texto);
  const cab = linhas[0] ?? [];
  const col = (nome: string) => cab.indexOf(nome);
  const c = Object.fromEntries(cab.map((n, i) => [n, i])) as Record<string, number>;
  if (col("CNPJ_CIA") < 0) return new Map();
  const indice: Indice = new Map();
  for (const l of linhas.slice(1)) {
    const cnpj = somenteDigitos(l[c.CNPJ_CIA] ?? "");
    if (cnpj.length !== 14) continue;
    const situacao = limpar(l[c.SIT]);
    const anterior = indice.get(cnpj);
    // Prefere a linha ativa e a de bolsa quando a companhia aparece mais de uma vez.
    if (anterior && (anterior.situacao === "ATIVO" && situacao !== "ATIVO")) continue;
    if (anterior && anterior.situacao === situacao && anterior.mercado === "BOLSA") continue;
    const emailsEmpresa = emails(limpar(l[c.EMAIL]));
    const emailsResp = emails(limpar(l[c.EMAIL_RESP]));
    const nomeResp = limpar(l[c.RESP]);
    indice.set(cnpj, {
      nome: limpar(l[c.DENOM_COMERC]) || limpar(l[c.DENOM_SOCIAL]),
      situacao,
      setor: limpar(l[c.SETOR_ATIV]) || undefined,
      mercado: limpar(l[c.TP_MERC]) || undefined,
      categoria: limpar(l[c.CATEG_REG]) || undefined,
      controleAcionario: limpar(l[c.CONTROLE_ACIONARIO]) || undefined,
      constituidaEm: limpar(l[c.DT_CONST]) || undefined,
      auditor: limpar(l[c.AUDITOR]) || undefined,
      emails: emailsEmpresa,
      telefone: telefone(limpar(l[c.DDD_TEL]), limpar(l[c.TEL])),
      responsavel: nomeResp
        ? {
            nome: nomeResp,
            cargo: titulo(limpar(l[c.TP_RESP])) || "Responsável cadastrado na CVM",
            emails: emailsResp.length ? emailsResp : emailsEmpresa,
            telefone: telefone(limpar(l[c.DDD_TEL_RESP]), limpar(l[c.TEL_RESP])) ?? telefone(limpar(l[c.DDD_TEL]), limpar(l[c.TEL])),
          }
        : undefined,
    });
  }
  return indice;
}

const memo = globalThis as unknown as { __cvm?: { ate: number; indice: Promise<Indice> } };

/** Baixa e indexa o cadastro (no máximo uma vez a cada 24 h por processo). */
export function carregarCvm(http: typeof fetch = fetch, agora: () => number = Date.now): Promise<Indice> {
  if (memo.__cvm && memo.__cvm.ate > agora()) return memo.__cvm.indice;
  const indice = (async () => {
    const r = await http(URL_CVM, { signal: AbortSignal.timeout(25_000), headers: { "User-Agent": "ConectaB2B/0.1" } });
    if (!r.ok) throw new Error(`CVM: HTTP ${r.status}`);
    return indexarCvm(new TextDecoder("latin1").decode(await r.arrayBuffer()));
  })();
  memo.__cvm = { ate: agora() + 24 * 3_600_000, indice };
  // Falha não fica guardada: a próxima tentativa baixa de novo.
  indice.catch(() => {
    if (memo.__cvm?.indice === indice) memo.__cvm = undefined;
  });
  return indice;
}

export async function buscarCvm(cnpj: string, http?: typeof fetch): Promise<InfoCvm | null> {
  return (await carregarCvm(http)).get(somenteDigitos(cnpj)) ?? null;
}

/** O Diretor de RI é uma pessoa com canal institucional publicado pela própria empresa: entra como contato de confiança alta. */
export function contatoDeRi(info: InfoCvm, agora = new Date().toISOString()): Contato[] {
  const r = info.responsavel;
  if (!r || info.situacao !== "ATIVO") return [];
  return [
    {
      nome: r.nome,
      cargo: r.cargo,
      senioridade: "Diretoria",
      departamento: "Relações com investidores",
      email: r.emails[0],
      emailStatus: r.emails.length ? "nao_verificado" : undefined,
      telefone: r.telefone,
      origem: "CVM (cadastro de companhia aberta)",
      obtidoEm: agora,
      confianca: 0.85,
    },
  ];
}
