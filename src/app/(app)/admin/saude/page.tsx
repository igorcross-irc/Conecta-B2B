import { connection } from "next/server";
import { contexto } from "@/lib/app";

export const metadata = { title: "Saúde do sistema" };

const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB` : `${Math.round(b / 1e6).toLocaleString("pt-BR")} MB`);
const LIMITE_PLANO_GRATIS = 1_073_741_824;

export default async function Saude() {
  await connection();
  const { servicos } = await contexto();
  const [s, erros] = await Promise.all([servicos.adminSaude(), servicos.adminErros(40)]);
  const uso = s.bancoBytes / LIMITE_PLANO_GRATIS;
  const versao = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kpi">
          <p className="kpi-rotulo">Banco de dados</p>
          <p className="kpi-valor">{mb(s.bancoBytes)}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className={`h-full rounded-full ${uso > 0.9 ? "bg-red-500" : uso > 0.75 ? "bg-amber-500" : "bg-marca-500"}`} style={{ width: `${Math.min(100, Math.round(uso * 100))}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{Math.round(uso * 100)}% do limite de 1 GB do plano grátis</p>
        </div>
        <div className="kpi"><p className="kpi-rotulo">Base da Receita</p><p className="kpi-valor">{s.empresasReceita.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-slate-500">{s.cobertura.map((c) => c.uf).join(", ") || "vazia"}</p></div>
        <div className="kpi"><p className="kpi-rotulo">Erros em 24 h</p><p className={`kpi-valor ${s.erros24h ? "text-red-700" : ""}`}>{s.erros24h}</p></div>
        <div className="kpi"><p className="kpi-rotulo">Falhas de fontes em 24 h</p><p className={`kpi-valor ${s.falhasFontes24h ? "text-amber-700" : ""}`}>{s.falhasFontes24h}<span className="text-sm font-normal text-slate-500"> de {s.chamadasFontes24h}</span></p></div>
      </div>
      <p className="text-xs text-slate-500">
        Empresas em cache: {s.empresasEmCache.toLocaleString("pt-BR")} · buscas em andamento: {s.buscasEmAndamento}
        {versao && <> · versão publicada: <code>{versao}</code></>}
        {" · "}<a className="underline" href="/api/saude">verificação automática (/api/saude)</a>
      </p>

      <section className="cartao p-0">
        <h2 className="border-b border-slate-100 p-4 font-semibold">Erros inesperados recentes</h2>
        {erros.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nenhum erro registrado nos últimos 30 dias.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {erros.map((e) => (
              <li key={e.id} className="space-y-0.5 p-3">
                <p className="flex flex-wrap justify-between gap-2"><span><span className="selo-cinza mr-2">{e.origem}</span>{e.mensagem}</span><time className="text-xs text-slate-500">{new Date(e.quando).toLocaleString("pt-BR")}</time></p>
                {e.detalhe && <p className="break-words text-xs text-slate-500">{e.detalhe}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
