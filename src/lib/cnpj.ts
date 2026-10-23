/** Utilitários de CNPJ: normalização, validação dos dígitos verificadores e formatação. */

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitoVerificador(base: string, pesos: number[]): number {
  const soma = base
    .split("")
    .reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Valida um CNPJ numérico (com ou sem pontuação). */
export function cnpjValido(valor: string): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const d1 = digitoVerificador(cnpj.slice(0, 12), PESOS_1);
  const d2 = digitoVerificador(cnpj.slice(0, 12) + d1, PESOS_2);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function formatarCnpj(valor: string): string {
  const c = somenteDigitos(valor);
  if (c.length !== 14) return valor;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** Endereço de site em forma canônica (sem protocolo, caminho nem www) ou null se inválido. */
export function normalizarDominio(valor: string): string | null {
  const d = valor.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/^www\./, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  if (/^\d+(\.\d+){3}$/.test(d)) return null;
  return d;
}

/** Alvo de pesquisa: CNPJ válido (14 dígitos) ou "site:dominio". Null se não for nenhum dos dois. */
export function normalizarAlvo(valor: string): string | null {
  const t = valor.trim();
  if (/^site:/i.test(t)) {
    const d = normalizarDominio(t.slice(5));
    return d ? `site:${d}` : null;
  }
  const digitos = somenteDigitos(t);
  return digitos.length === 14 && cnpjValido(digitos) ? digitos : null;
}

export const alvoValido = (valor: string): boolean => normalizarAlvo(valor) !== null;

/** Chave interna do alvo (CNPJ só com dígitos ou "site:dominio"). */
export const chaveAlvo = (valor: string): string => normalizarAlvo(valor) ?? somenteDigitos(valor);

/** Texto sem acento, em minúsculas e só com letras e números, para comparar na pesquisa. */
export function normalizarBusca(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
