import { normalizarBusca } from "./cnpj";
import { faixasDeSetores } from "./setores";

/**
 * Aderência ao perfil de cliente ideal (ICP) de uma organização: de 0 a 100, sobre as dimensões que o perfil define.
 * A mesma regra existe em TypeScript (`pontuar`, para explicar cada nota) e em SQL (`sqlAderencia`, para ordenar a pesquisa inteira);
 * o teste de serviços confere que as duas dão o mesmo resultado.
 */
export interface PerfilIdeal {
  setores: string[];
  portes: string[];
  ufs: string[];
  cidades: string[];
  idadeMin?: number;
  idadeMax?: number;
  exigeEmail: boolean;
  exigeTelefone: boolean;
}

export const PERFIL_VAZIO: PerfilIdeal = { setores: [], portes: [], ufs: [], cidades: [], exigeEmail: false, exigeTelefone: false };

export type Dimensao = "setor" | "porte" | "regiao" | "idade" | "contato";
export const PESOS: Record<Dimensao, number> = { setor: 30, porte: 20, regiao: 25, idade: 15, contato: 10 };
export const ROTULO_DIMENSAO: Record<Dimensao, string> = { setor: "Setor", porte: "Porte", regiao: "Região", idade: "Idade da empresa", contato: "Contato cadastral" };

export interface EmpresaParaNota {
  cnae?: number;
  porte?: string;
  uf?: string;
  municipio?: string;
  abertaEm?: string;
  temEmail: boolean;
  temTelefone: boolean;
}

export interface Motivo {
  dimensao: Dimensao;
  ok: boolean;
}

export interface Nota {
  /** 0 a 100. */
  nota: number;
  motivos: Motivo[];
}

export const dimensoesAtivas = (p: PerfilIdeal): Dimensao[] => [
  ...(p.setores.length ? (["setor"] as const) : []),
  ...(p.portes.length ? (["porte"] as const) : []),
  ...(p.ufs.length || p.cidades.length ? (["regiao"] as const) : []),
  ...(p.idadeMin !== undefined || p.idadeMax !== undefined ? (["idade"] as const) : []),
  ...(p.exigeEmail || p.exigeTelefone ? (["contato"] as const) : []),
];

const semAcento = (t: string) => normalizarBusca(t);

/** Idade em anos completos na data `hoje`; null se a abertura é desconhecida. */
export function idadeEmAnos(abertaEm: string | undefined, hoje: Date): number | null {
  if (!abertaEm) return null;
  const a = new Date(`${abertaEm.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a.getTime())) return null;
  let anos = hoje.getUTCFullYear() - a.getUTCFullYear();
  const antes = hoje.getUTCMonth() < a.getUTCMonth() || (hoje.getUTCMonth() === a.getUTCMonth() && hoje.getUTCDate() < a.getUTCDate());
  if (antes) anos--;
  return anos;
}

export function pontuar(p: PerfilIdeal, e: EmpresaParaNota, hoje: Date = new Date()): Nota | null {
  const dims = dimensoesAtivas(p);
  if (dims.length === 0) return null;
  const faixas = faixasDeSetores(p.setores);
  const cidades = p.cidades.map(semAcento);
  const idade = idadeEmAnos(e.abertaEm, hoje);
  const ok: Record<Dimensao, () => boolean> = {
    setor: () => e.cnae !== undefined && faixas.some(([a, b]) => e.cnae! >= a && e.cnae! <= b),
    porte: () => e.porte !== undefined && p.portes.includes(e.porte),
    regiao: () =>
      (p.ufs.length === 0 || (e.uf !== undefined && p.ufs.includes(e.uf))) &&
      (cidades.length === 0 || (e.municipio !== undefined && cidades.includes(semAcento(e.municipio)))),
    idade: () => idade !== null && (p.idadeMin === undefined || idade >= p.idadeMin) && (p.idadeMax === undefined || idade <= p.idadeMax),
    contato: () => (!p.exigeEmail || e.temEmail) && (!p.exigeTelefone || e.temTelefone),
  };
  const motivos = dims.map((d) => ({ dimensao: d, ok: ok[d]() }));
  const total = dims.reduce((s, d) => s + PESOS[d], 0);
  const feito = motivos.reduce((s, m) => s + (m.ok ? PESOS[m.dimensao] : 0), 0);
  return { nota: Math.round((100 * feito) / total), motivos };
}

const TRADUZIR = "'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc'";

/** Expressão SQL (0 a 100, arredondada) equivalente a `pontuar`, sobre a tabela rf_estabelecimento apelidada de `e`. Null sem dimensões. */
export function sqlAderencia(p: PerfilIdeal, add: (v: unknown) => string): string | null {
  const dims = dimensoesAtivas(p);
  if (dims.length === 0) return null;
  const partes: string[] = [];
  if (dims.includes("setor")) {
    const f = faixasDeSetores(p.setores).map(([a, b]) => `e.cnae between ${a} and ${b}`).join(" or ") || "false";
    partes.push(`(case when (${f}) then ${PESOS.setor} else 0 end)`);
  }
  if (dims.includes("porte")) partes.push(`(case when e.porte = any(${add(p.portes)}::text[]) then ${PESOS.porte} else 0 end)`);
  if (dims.includes("regiao")) {
    const cond: string[] = [];
    if (p.ufs.length) cond.push(`e.uf = any(${add(p.ufs)}::text[])`);
    if (p.cidades.length) cond.push(`lower(translate(e.municipio, ${TRADUZIR})) = any(${add(p.cidades.map(semAcento))}::text[])`);
    partes.push(`(case when ${cond.join(" and ")} then ${PESOS.regiao} else 0 end)`);
  }
  if (dims.includes("idade")) {
    const cond = ["e.aberta_em is not null"];
    if (p.idadeMin !== undefined) cond.push(`date_part('year', age(current_date, e.aberta_em)) >= ${Math.floor(p.idadeMin)}`);
    if (p.idadeMax !== undefined) cond.push(`date_part('year', age(current_date, e.aberta_em)) <= ${Math.floor(p.idadeMax)}`);
    partes.push(`(case when ${cond.join(" and ")} then ${PESOS.idade} else 0 end)`);
  }
  if (dims.includes("contato")) {
    const cond = [p.exigeEmail ? "e.email is not null" : "true", p.exigeTelefone ? "e.telefone is not null" : "true"];
    partes.push(`(case when ${cond.join(" and ")} then ${PESOS.contato} else 0 end)`);
  }
  const total = dims.reduce((s, d) => s + PESOS[d], 0);
  return `round(100.0 * (${partes.join(" + ")}) / ${total})::int`;
}

/** Valida e limpa um perfil vindo do formulário ou do banco: só valores conhecidos, tamanhos limitados. */
export function limparPerfil(bruto: unknown, setoresValidos: string[], portesValidos: string[], ufsValidas: string[]): PerfilIdeal {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const lista = (v: unknown, validos?: string[], max = 40) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter((x) => x && (!validos || validos.includes(x))))].slice(0, max) : [];
  const ano = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 200 ? Math.floor(n) : undefined;
  };
  let idadeMin = ano(r.idadeMin);
  let idadeMax = ano(r.idadeMax);
  if (idadeMin !== undefined && idadeMax !== undefined && idadeMin > idadeMax) [idadeMin, idadeMax] = [idadeMax, idadeMin];
  return {
    setores: lista(r.setores, setoresValidos),
    portes: lista(r.portes, portesValidos),
    ufs: lista(r.ufs, ufsValidas),
    cidades: lista(r.cidades, undefined, 20).map((c) => c.slice(0, 60)),
    ...(idadeMin !== undefined ? { idadeMin } : {}),
    ...(idadeMax !== undefined ? { idadeMax } : {}),
    exigeEmail: r.exigeEmail === true,
    exigeTelefone: r.exigeTelefone === true,
  };
}
