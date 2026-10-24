import { permitirPedidoPublico, registrarErroApp } from "@/lib/app";
import { ipDoPedido } from "@/lib/ip";

/** POST /api/erro { mensagem, digest?, caminho? } — erros que acontecem no navegador (tela quebrada). Limite: 20 por hora por IP. */
export async function POST(req: Request) {
  try {
    if (!(await permitirPedidoPublico(`erro-tela:${ipDoPedido(req)}`, 20, 3600))) return Response.json({ ok: false }, { status: 429 });
    const c = (await req.json()) as { mensagem?: unknown; digest?: unknown; caminho?: unknown };
    const corta = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").slice(0, n) : "");
    await registrarErroApp("tela", corta(c.mensagem, 300) || "Erro de tela", [corta(c.caminho, 120), corta(c.digest, 40)].filter(Boolean).join(" · "));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
