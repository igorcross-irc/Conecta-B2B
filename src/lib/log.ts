/**
 * Log estruturado (uma linha de JSON por evento), que a Vercel guarda e permite filtrar por campo.
 * Sem dependência externa. Nunca registre e-mail, telefone, CPF ou o conteúdo de um contato: só nomes de fonte, ids e mensagens curtas.
 */
export type Nivel = "info" | "warn" | "error";

export function escrever(nivel: Nivel, evento: string, campos: Record<string, unknown> = {}): void {
  const linha = JSON.stringify({ t: new Date().toISOString(), nivel, evento, ...campos });
  (nivel === "error" ? console.error : nivel === "warn" ? console.warn : console.log)(linha);
}

export const log = {
  info: (evento: string, campos?: Record<string, unknown>) => escrever("info", evento, campos),
  warn: (evento: string, campos?: Record<string, unknown>) => escrever("warn", evento, campos),
  error: (evento: string, campos?: Record<string, unknown>) => escrever("error", evento, campos),
};

/** Mensagem curta e segura de um erro qualquer (corta e tira quebras de linha). */
export function mensagemDe(e: unknown, max = 300): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "Erro desconhecido";
  return m.replace(/\s+/g, " ").slice(0, max);
}
