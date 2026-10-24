import { log, mensagemDe } from "./log";

export type TipoFonte = "empresa" | "contatos" | "enriquecimento" | "ia" | "email";

export interface Execucao {
  provedor: string;
  tipo: TipoFonte;
  ok: boolean;
  ms: number;
  itens?: number;
  erro?: string;
}

/** Quem grava a execução (no app, o banco). Nunca pode derrubar a chamada monitorada. */
export type Registrador = (e: Execucao) => Promise<void> | void;

/** Mede uma chamada, registra sucesso/falha e tempo, e devolve o resultado ou relança o erro original. */
export async function medir<T>(
  provedor: string,
  tipo: TipoFonte,
  chamada: () => Promise<T>,
  registrar: Registrador,
  contar: (r: T) => number | undefined = (r) => (Array.isArray(r) ? r.length : r == null ? 0 : undefined),
): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await chamada();
    void guardar(registrar, { provedor, tipo, ok: true, ms: Date.now() - t0, itens: contar(r) });
    return r;
  } catch (e) {
    void guardar(registrar, { provedor, tipo, ok: false, ms: Date.now() - t0, erro: mensagemDe(e) });
    throw e;
  }
}

async function guardar(registrar: Registrador, e: Execucao) {
  try {
    await registrar(e);
  } catch (err) {
    log.warn("monitor.falha_ao_registrar", { provedor: e.provedor, erro: mensagemDe(err) });
  }
}

type ComNome = { nome: string };

/** Envolve um provedor de contatos para registrar cada chamada a `buscar`. */
export function monitorarContatos<P extends ComNome & { buscar: (...a: never[]) => Promise<unknown[]> }>(p: P, registrar: Registrador): P {
  return new Proxy(p, {
    get(alvo, prop, receptor) {
      const v = Reflect.get(alvo, prop, receptor);
      if (prop !== "buscar" || typeof v !== "function") return v;
      return (...args: unknown[]) => medir(alvo.nome, "contatos", () => (v as (...a: unknown[]) => Promise<unknown[]>).apply(alvo, args), registrar);
    },
  });
}

/** Envolve um provedor de empresa para registrar cada chamada a `buscarPorCnpj`. */
export function monitorarEmpresa<P extends ComNome & { buscarPorCnpj: (c: string) => Promise<unknown> }>(p: P, registrar: Registrador): P {
  return new Proxy(p, {
    get(alvo, prop, receptor) {
      const v = Reflect.get(alvo, prop, receptor);
      if (prop !== "buscarPorCnpj" || typeof v !== "function") return v;
      return (...args: unknown[]) =>
        // "Não achou" (null) é resposta válida, não falha da fonte: conta como sucesso com 0 itens.
        medir(alvo.nome, "empresa", () => (v as (...a: unknown[]) => Promise<unknown>).apply(alvo, args), registrar, (r) => (r ? 1 : 0));
    },
  });
}

export type EstadoFonte = "sem_uso" | "ok" | "atencao" | "fora";

/** Semáforo de uma fonte pelas chamadas das últimas 24 h: 95% ou mais de sucesso = ok; 70% a 95% = atenção; abaixo = fora do ar. */
export function estadoDaFonte(chamadas24h: number, falhas24h: number): EstadoFonte {
  if (chamadas24h === 0) return "sem_uso";
  const taxa = (chamadas24h - falhas24h) / chamadas24h;
  return taxa >= 0.95 ? "ok" : taxa >= 0.7 ? "atencao" : "fora";
}
