import Link from "next/link";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { formatarCnpj } from "@/lib/cnpj";

export const metadata = { title: "Base comum" };

export default async function Base({ searchParams }: PageProps<"/base">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const uf = typeof sp.uf === "string" ? sp.uf : "";
  const pagina = Math.max(0, Number(typeof sp.p === "string" ? sp.p : 0) || 0);
  const { servicos } = await contexto();
  const { itens, total } = await servicos.listarBase({ q, uf, pagina });
  const href = (p: number) => `/base?${new URLSearchParams({ ...(q && { q }), ...(uf && { uf }), p: String(p) })}`;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">Base comum</h1>
        <p className="sub-pagina">
          Empresas já pesquisadas por qualquer usuário. Tudo o que é descoberto fica aqui e pode ser reaproveitado e
          corrigido por todos: buscas repetidas custam menos e ficam mais completas.
        </p>
      </header>

      <form className="cartao flex flex-wrap items-end gap-3" role="search">
        <label className="min-w-64 flex-1">
          <span className="rotulo">Buscar</span>
          <input name="q" defaultValue={q} className="input mt-1" placeholder="Nome, atividade, cidade ou início do CNPJ" />
        </label>
        <label>
          <span className="rotulo">UF</span>
          <input name="uf" defaultValue={uf} maxLength={2} className="input mt-1 w-20 uppercase" placeholder="SP" />
        </label>
        <button className="btn-primario">Filtrar</button>
      </form>

      <p className="text-sm text-slate-600">{total} empresa(s) na base</p>

      {itens.length === 0 ? (
        <div className="cartao text-sm text-slate-600">
          Nada por aqui ainda. Pesquise uma empresa em{" "}
          <Link href="/descobrir" className="font-medium text-marca-700 underline">Descobrir</Link> e ela entra na base.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {itens.map((e) => (
            <li key={e.cnpj}>
              <Link href={`/base/${e.cnpj}`} className="cartao block h-full transition hover:border-marca-500">
                <p className="font-semibold">{e.nomeFantasia || e.razaoSocial}</p>
                <p className="text-xs text-slate-500">
                  {formatarCnpj(e.cnpj)}
                  {e.municipio && ` · ${e.municipio}/${e.uf}`}
                </p>
                {e.atividade && <p className="mt-1 text-sm text-slate-600">{e.atividade}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.noPool + e.daComunidade > 0 && (
                    <span className="selo">{e.noPool + e.daComunidade} contato(s) disponíveis</span>
                  )}
                  {e.dominio && <span className="selo-cinza">{e.dominio}</span>}
                  {e.tags.map((t) => <span key={t} className="selo-cinza">#{t}</span>)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav className="flex gap-3 text-sm" aria-label="Paginação">
        {pagina > 0 && <Link className="btn-sec" href={href(pagina - 1)}>← Anterior</Link>}
        {(pagina + 1) * 24 < total && <Link className="btn-sec" href={href(pagina + 1)}>Próxima →</Link>}
      </nav>
    </div>
  );
}
