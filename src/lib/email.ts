/**
 * Envio de e-mail transacional pelo Resend (https://resend.com), sem dependência extra.
 * Configure RESEND_API_KEY e EMAIL_REMETENTE (ex.: "Conecta B2B <nao-responda@seudominio.com.br>").
 * Sem essas variáveis o envio fica desligado e quem chama decide o que fazer.
 */
export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE);
}

/** URL pública do app, para montar links enviados por e-mail. */
export function urlPublica(): string {
  const url = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
}

export async function enviarEmail(m: MensagemEmail, http: typeof fetch = fetch): Promise<void> {
  if (!emailConfigurado()) throw new Error("Envio de e-mail não configurado.");
  const res = await http("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_REMETENTE, to: [m.para], subject: m.assunto, text: m.texto }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Falha ao enviar e-mail (${res.status}).`);
}
