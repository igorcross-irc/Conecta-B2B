import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { estadoDaFonte, type EstadoFonte } from "@/lib/monitor";

export const metadata = { title: "Fontes de dados" };

const TIPO: Record<string, string> = { empresa: "Ficha da empresa", contatos: "Pessoas", enriquecimento: "Informações extras", ia: "IA", email: "E-mail" };
const ESTADO: Record<EstadoFonte, { rotulo: string; classe: string; ponto: string }> = {
  ok: { rotulo: "Funcionando", classe: "bg-emerald-50 text-emerald-800 ring-emerald-200", ponto: "bg-emerald-500" },
  atencao: { rotulo: "Atenção", classe: "bg-amber-50 text-amber-900 ring-amber-200", ponto: "bg-amber-500" },
  fora: { rotulo: "Com falhas", classe: "bg-red-50 text-red-800 ring-red-200", ponto: "bg-red-500" },
  sem_uso: { rotulo: "Sem uso em 24 h", classe: "bg-slate-100 text-slate-600 ring-slate-200", ponto: "bg-slate-400" },
};
const ms = (v?: number) => (v === undefined ? "—" : v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : `${v} ms`);
const quando = (d?: string) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export default async function Provedores() {
  await connection();
  const { servicos } = await contexto();
  const [fontes, falhas] = await Promise.all([servicos.adminProvedores(), servicos.adminFalhasProvedores(20)]);
  const resumo = (Object.keys(ESTADO) as EstadoFonte[]).map((e) => ({ e, n: fontes.filter((f) => estadoDaFonte(f.chamadas24h, f.falhas24h) === e).length }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Cada chamada a uma fonte de dados é registrada (sucesso, falha e tempo). Aparece aqui o que foi usado nos últimos 7 dias; fontes que ninguém acionou não têm linha.
      </p>

      {fontes.length === 0 ? (
        <div className="vazio">
          <p className="font-medium text-tinta">Ainda não há chamadas registradas</p>
          <p>Faça uma busca em Descobrir e volte aqui. (Em modo demonstração as fontes são fictícias e não são monitoradas.)</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {resumo.filter((r) => r.n > 0).map(({ e, n }) => (
              <span key={e} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 ${ESTADO[e].classe}`}>
                <span className={`h-2 w-2 rounded-full ${ESTADO[e].ponto}`} aria-hidden />{n} {ESTADO[e].rotulo.toLowerCase()}
              </span>
            ))}
          </div>

          <ul className="grid gap-3 lg:grid-cols-2">
            {fontes.map((f) => {
              const est = ESTADO[estadoDaFonte(f.chamadas24h, f.falhas24h)];
              const taxa7 = f.chamadas7d ? Math.round(((f.chamadas7d - f.falhas7d) / f.chamadas7d) * 100) : undefined;
              return (
                <li key={f.provedor} className="cartao min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{f.provedor}</h2>
                      <p className="text-xs text-slate-500">{TIPO[f.tipo] ?? f.tipo}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${est.classe}`}>
                      <span className={`h-2 w-2 rounded-full ${est.ponto}`} aria-hidden />{est.rotulo}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div><dt className="kpi-rotulo">Chamadas 24 h</dt><dd className="font-semibold">{f.chamadas24h}</dd></div>
                    <div><dt className="kpi-rotulo">Falhas 24 h</dt><dd className={`font-semibold ${f.falhas24h ? "text-red-700" : ""}`}>{f.falhas24h}</dd></div>
                    <div><dt className="kpi-rotulo">Tempo típico</dt><dd className="font-semibold">{ms(f.p50)}</dd></div>
                    <div><dt className="kpi-rotulo">Tempo p95</dt><dd className="font-semibold">{ms(f.p95)}</dd></div>
                  </dl>
                  <p className="break-words text-xs text-slate-500">
                    7 dias: {f.chamadas7d} chamadas{taxa7 !== undefined && <>, {taxa7}% com sucesso</>}
                    {f.itensMedio !== undefined && <> · {f.itensMedio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} resultado(s) por chamada em média</>}
                    <br />Último sucesso: {quando(f.ultimoSucesso)} · última falha: {quando(f.ultimaFalha)}
                  </p>
                  {f.ultimoErro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 break-words">Último erro: {f.ultimoErro}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {falhas.length > 0 && (
        <section className="cartao p-0">
          <h2 className="border-b border-slate-100 p-4 font-semibold">Falhas recentes</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {falhas.map((x, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span className="min-w-0"><b>{x.provedor}</b> <span className="text-slate-500 break-words">· {x.erro || "sem mensagem"}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{quando(x.quando)} · {ms(x.ms)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
