import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { chaveGemini } from "@/lib/ia/gemini";
import { emailConfigurado } from "@/lib/email";
import { FormTesteIA } from "./FormTesteIA";

const STATUS: { nome: string; efeito: string; ok: () => boolean }[] = [
  { nome: "GEMINI_API_KEY", efeito: "Busca em linguagem natural, mensagem de abordagem e busca web de pessoas", ok: () => Boolean(chaveGemini()) },
  { nome: "TAVILY_API_KEY", efeito: "Busca web de pessoas (junto com o Gemini)", ok: () => Boolean(process.env.TAVILY_API_KEY) },
  { nome: "HUNTER_API_KEY", efeito: "E-mails de pessoas pelo Hunter", ok: () => Boolean(process.env.HUNTER_API_KEY) },
  { nome: "RESEND_API_KEY + EMAIL_REMETENTE", efeito: "Confirmação do opt-out e avisos das pesquisas salvas", ok: emailConfigurado },
  { nome: "CRON_SECRET", efeito: "Avisos diários das pesquisas salvas", ok: () => Boolean(process.env.CRON_SECRET) },
  { nome: "APP_URL", efeito: "Endereço usado nos links dos e-mails (senão usa o domínio de produção da Vercel)", ok: () => Boolean(process.env.APP_URL) },
];

export const metadata = { title: "Teste de IA" };

export default async function TesteIA() {
  await connection();
  await contexto();
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">IA e chaves</h2>
        <p className="sub-pagina">
          Chave {chaveGemini() ? "encontrada" : "não encontrada"} no ambiente
          {process.env.GEMINI_MODEL ? ` · modelo fixado: ${process.env.GEMINI_MODEL}` : " · modelo escolhido automaticamente (flash-lite mais novo)"}.
        </p>
      </header>
      <section className="cartao text-sm">
        <h2 className="mb-2 font-medium">Integrações configuradas neste ambiente</h2>
        <p className="mb-2 text-xs text-slate-500">Só mostra se a variável existe, nunca o valor. Configure em Vercel → Settings → Environment Variables e faça um novo deploy.</p>
        <ul className="divide-y divide-slate-100">
          {STATUS.map((i) => (
            <li key={i.nome} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{i.nome}</span>
                <span className="block text-xs text-slate-500">{i.efeito}</span>
              </span>
              <span className={i.ok() ? "text-emerald-700" : "text-slate-500"}>{i.ok() ? "configurado" : "não configurado"}</span>
            </li>
          ))}
        </ul>
      </section>
      <FormTesteIA />
    </div>
  );
}
