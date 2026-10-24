/** Cliente mínimo da API do Gemini (Google AI Studio). Chave em GEMINI_API_KEY (ou GOOGLE_API_KEY). */
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export type ResultadoIA = {
  ok: boolean;
  chave: boolean;
  modelo?: string;
  modelosFlash?: string[];
  resposta?: string;
  ms?: number;
  erro?: string;
};

export function chaveGemini(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

type ModeloApi = { name: string; supportedGenerationMethods?: string[] };

/** Escolhe um modelo "flash" barato: o de GEMINI_MODEL, senão o flash-lite mais novo, senão o flash mais novo. */
export function escolherModelo(modelos: string[], preferido?: string): string | undefined {
  if (preferido) return preferido.replace(/^models\//, "");
  const flash = modelos.filter((m) => /flash/.test(m) && !/(image|tts|live|audio|preview-\d|thinking|exp|embedding)/.test(m));
  const ordenar = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });
  const lite = flash.filter((m) => /lite/.test(m)).sort(ordenar);
  return lite[0] ?? flash.sort(ordenar)[0] ?? modelos.sort(ordenar)[0];
}

export async function listarModelos(chave: string, f: typeof fetch = fetch): Promise<string[]> {
  const r = await f(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": chave }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Listagem de modelos: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { models?: ModeloApi[] };
  return (j.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

export async function gerarTexto(chave: string, modelo: string, prompt: string, f: typeof fetch = fetch): Promise<string> {
  const r = await f(`${BASE}/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Geração (${modelo}): HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}

/** Teste ponta a ponta: lista modelos, escolhe um e pede uma resposta curta. Nunca devolve a chave. */
export async function testarGemini(prompt: string, f: typeof fetch = fetch): Promise<ResultadoIA> {
  const chave = chaveGemini();
  if (!chave) return { ok: false, chave: false, erro: "Nenhuma chave encontrada. Defina GEMINI_API_KEY nas variáveis de ambiente do projeto na Vercel e faça um novo deploy." };
  const t0 = Date.now();
  try {
    const modelos = await listarModelos(chave, f);
    const modelo = escolherModelo(modelos, process.env.GEMINI_MODEL);
    if (!modelo) return { ok: false, chave: true, erro: "A chave funciona, mas nenhum modelo com generateContent foi listado." };
    const resposta = await gerarTexto(chave, modelo, prompt, f);
    return { ok: true, chave: true, modelo, modelosFlash: modelos.filter((m) => /flash/.test(m)).slice(0, 12), resposta, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, chave: true, erro: (e as Error).message };
  }
}

/** Pede uma resposta em JSON ao Gemini e já a converte. Devolve null se a resposta não for JSON válido. */
export async function gerarJson<T>(chave: string, modelo: string, prompt: string, f: typeof fetch = fetch): Promise<T | null> {
  const r = await f(`${BASE}/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`Gemini (${modelo}): HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const texto = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  try {
    return JSON.parse(texto.replace(/^```(?:json)?|```$/g, "")) as T;
  } catch {
    return null;
  }
}

const memoModelo = globalThis as unknown as { __modeloGemini?: { chave: string; modelo: string; ate: number } };

/** Modelo a usar nas chamadas do app: o de GEMINI_MODEL ou o flash-lite mais novo (lista guardada por 1 hora). */
export async function modeloPadrao(chave: string, f: typeof fetch = fetch): Promise<string> {
  const m = memoModelo.__modeloGemini;
  if (m && m.chave === chave && m.ate > Date.now()) return m.modelo;
  const modelo = escolherModelo(await listarModelos(chave, f), process.env.GEMINI_MODEL);
  if (!modelo) throw new Error("Nenhum modelo do Gemini disponível para esta chave.");
  memoModelo.__modeloGemini = { chave, modelo, ate: Date.now() + 3_600_000 };
  return modelo;
}
