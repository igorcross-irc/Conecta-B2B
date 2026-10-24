import { abrirBanco } from "@/db/conexao";

/**
 * GET /api/saude — verificação para monitores externos (UptimeRobot, Better Stack etc.): responde 200 com o banco acessível, 503 sem.
 * Não expõe dado nenhum além de "ok" e do tempo de resposta do banco.
 */
const g = globalThis as unknown as { __conectaBanco?: ReturnType<typeof abrirBanco> };

export async function GET() {
  const t0 = Date.now();
  try {
    const banco = await (g.__conectaBanco ??= abrirBanco());
    await banco.comUsuario("00000000-0000-0000-0000-000000000000").query("select 1");
    return Response.json({ ok: true, bancoMs: Date.now() - t0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
