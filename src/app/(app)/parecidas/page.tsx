import Link from "next/link";
import { connection } from "next/server";
import { consultaPermitida, contexto } from "@/lib/app";
import { LimiteDeConsultas } from "@/components/LimiteDeConsultas";
import { Predio } from "@/components/Icones";

export const metadata = { title: "Empresas parecidas" };

const fmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export default async function Parecidas({ searchParams }: PageProps<"/parecidas">) {
  await connection();
  if (!(await consultaPermitida())) return <LimiteDeConsultas />;
  const sp = await searchParams;
  const cnpj = (typeof sp.cnpj === "string" ? sp.cnpj : "").replace(/\D/g, "");
  const { servicos } = await contexto();
  const r = cnpj.length === 14 ? await servicos.parecidas(cnpj, 50) : { referencia: null, itens: [] };

  const voltaPara = (alvo: string) => `/empresa/${alvo}?de=${encodeURIComponent(`/parecidas?cnpj=${cnpj}`)}`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="titulo-pagina">Empresas parecidas</h1>
        <p className="sub-pagina">Outras empresas do mesmo setor e estado, ordenadas pelo quanto se parecem com a de referência. Dados públicos da Receita, sem gastar crédito.</p>
      </header>

      {!r.referencia ? (
        <div className="vazio">
          <Predio width={32} height={32} className="text-slate-400" />
          <p className="font-medium text-tinta">Não encontrei essa empresa na base da Receita carregada</p>
          <p>Abra uma empresa pela Pesquisa e use o botão “Empresas parecidas”. Se ela for de um estado que a base ainda não cobre, não há como comparar.</p>
          <Link href="/pesquisar" className="btn-sec">Ir para a Pesquisa</Link>
        </div>
      ) : (
        <>
          <section className="cartao-destaque space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-marca-700">Empresa de referência</p>
            <Link href={voltaPara(r.referencia.cnpj)} className="block text-lg font-semibold text-marca-800 hover:underline">{r.referencia.nomeFantasia || r.referencia.razaoSocial}</Link>
            <p className="text-sm text-slate-600">{[r.referencia.municipio, r.referencia.uf].filter(Boolean).join("/")}{r.referencia.porte ? ` · ${r.referencia.porte}` : ""}{r.referencia.atividade ? ` · ${r.referencia.atividade}` : ""}</p>
          </section>

          {r.itens.length === 0 ? (
            <div className="vazio"><p className="font-medium text-tinta">Nenhuma outra empresa parecida na base</p></div>
          ) : (
            <ul className="space-y-3">
              {r.itens.map((i) => (
                <li key={i.cnpj} className="cartao flex flex-col gap-3 transition hover:border-marca-200 hover:shadow-md sm:flex-row sm:items-center">
                  <div className="flex shrink-0 items-center gap-2 sm:w-24 sm:flex-col sm:gap-1" title="Quanto se parece com a empresa de referência">
                    <span className="text-xl font-semibold text-marca-700">{i.semelhanca}%</span>
                    <span className="h-1.5 w-24 rounded-full bg-slate-100 sm:w-full" aria-hidden><span className="block h-1.5 rounded-full bg-marca-600" style={{ width: `${i.semelhanca}%` }} /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={voltaPara(i.cnpj)} className="block truncate font-semibold text-marca-800 hover:underline">{i.nomeFantasia || i.razaoSocial}</Link>
                    <p className="truncate text-xs text-slate-500">{i.razaoSocial} · {fmt(i.cnpj)}</p>
                    <p className="mt-1 truncate text-sm text-slate-600">{[i.bairro, i.municipio, i.uf].filter(Boolean).join(" · ")}{i.atividade ? ` — ${i.atividade}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {i.iguais.map((x) => <span key={x} className="selo">{x}</span>)}
                      {i.porte && <span className="selo-cinza">{i.porte}</span>}
                    </div>
                  </div>
                  <Link href={voltaPara(i.cnpj)} className="btn-sec shrink-0 sm:self-center">Abrir empresa</Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
