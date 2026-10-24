import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { Base, Equipe, Busca, Plataforma } from "@/components/Icones";
import { FormRecarga, FormCustos } from "./Formularios";

export const metadata = { title: "Plataforma" };

export default async function Admin() {
  await connection();
  const { servicos } = await contexto();
  const [r, orgs] = await Promise.all([servicos.adminResumo(), servicos.adminOrganizacoes()]);
  const kpis: { rotulo: string; valor: number; icone: React.ReactNode }[] = [
    { rotulo: "Organizações", valor: r.organizacoes, icone: <Plataforma width={18} height={18} /> },
    { rotulo: "Usuários", valor: r.usuarios, icone: <Equipe width={18} height={18} /> },
    { rotulo: "Empresas em cache", valor: r.empresasNaBase, icone: <Base width={18} height={18} /> },
    { rotulo: "Buscas (30 dias)", valor: r.buscas30d, icone: <Busca width={18} height={18} /> },
  ];
  const outros: [string, number][] = [
    ["Varreduras guardadas", r.varreduras],
    ["Contatos no pool", r.contatosNoPool],
    ["Contatos da comunidade", r.contatosDaComunidade],
    ["Opt-outs", r.optOuts],
  ];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
        {kpis.map((k) => (
          <div key={k.rotulo} className="kpi">
            <p className="kpi-rotulo flex items-center gap-1.5 text-marca-700">{k.icone}<span className="text-slate-500">{k.rotulo}</span></p>
            <p className="kpi-valor mt-1">{k.valor.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </section>
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
        {outros.map(([k, v]) => <span key={k}>{k}: <b className="text-tinta">{v.toLocaleString("pt-BR")}</b></span>)}
      </p>

      <section className="space-y-3">
        <h2 className="secao-titulo">Organizações ({orgs.length})</h2>
        <ul className="space-y-3">
          {orgs.map((o) => (
            <li key={o.id}>
              <details className="cartao group p-0">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 marker:hidden">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-lg font-semibold text-marca-700" aria-hidden>{o.nome.charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.nome}</span>
                    {o.admins && <span className="block truncate text-xs text-slate-500">{o.admins}</span>}
                  </span>
                  <span className="flex flex-wrap gap-1.5 text-xs">
                    <span className="selo-cinza">{o.membros} membro(s)</span>
                    <span className="selo-cinza">{o.buscas} busca(s)</span>
                    <span className="selo">{o.saldo} créditos</span>
                  </span>
                  <span className="text-slate-400 transition group-open:rotate-180" aria-hidden>⌄</span>
                </summary>
                <div className="grid gap-5 border-t border-slate-100 p-4 md:grid-cols-2">
                  <FormRecarga org={o.id} />
                  <FormCustos org={o.id} custos={o.custos} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
