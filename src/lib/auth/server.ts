import { createNeonAuth } from "@neondatabase/auth/next/server";

type Auth = ReturnType<typeof createNeonAuth>;
const g = globalThis as unknown as { __conectaAuth?: Auth };

/**
 * Neon Auth (Better Auth gerenciado). Só liga quando as duas variáveis existirem;
 * sem elas o app roda em modo demonstração, com um usuário fixo.
 */
export function getAuth(): Auth | null {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) return null;
  g.__conectaAuth ??= createNeonAuth({ baseUrl, cookies: { secret } });
  return g.__conectaAuth;
}
