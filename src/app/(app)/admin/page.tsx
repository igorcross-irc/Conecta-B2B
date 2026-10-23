import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { FormRecarga, FormCustos } from "./Formularios";

export const metadata = { title: "Plataforma" };

export default async function Admin() {
  await connection();
  const { sessao, servicos } = await contexto();
  if (!sessao.operadora) redirect("/descobrir");
  const r = await servicos.adminResumo();
  const orgs = await servicos.adminOrganizacoes();
  const kpis: [string, number][] = [
    ["Organizações", r.organizacoes],
    ["Usuários", r.usuarios],
    ["Empresas na base", r.empresasNaBase],
    ["Varreduras guardadas", r.varreduras],
    ["Contatos no pool", r.contatosNoPool],
    ["Contatos da comunidade", r.contatosDaComunidade],
    ["Buscas (30 dias)", r.buscas30d],
    ["Opt-outs", r.optOuts],
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">Plataforma</h1>
        <p className="sub-pagina">Visão da operadora: todas as organizações, créditos e custos.</p>
        <Link href="/admin/ia" className="text-sm text-marca-700 underline">Teste de IA (Gemini)</Link>
      </header>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([k, v]) => (
          <div key={k} className="cartao">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-2xl font-semibold text-marca-700">{v}</p>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Organizações</h2>
        {orgs.map((o) => (
          <div key={o.id} className="cartao space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-semibold">{o.nome}</p>
                {o.admins && <p className="text-xs text-slate-500">{o.admins}</p>}
              </div>
              <p className="text-sm text-slate-500">
                {o.membros} membro(s) · {o.buscas} busca(s) · saldo <b className="text-marca-700">{o.saldo}</b>
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormRecarga org={o.id} />
              <FormCustos org={o.id} custos={o.custos} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
