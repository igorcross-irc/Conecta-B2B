import Link from "next/link";
import { connection } from "next/server";
import { Paginacao } from "@/components/Paginacao";
import { Base as IconeBase, Busca, Externo, Mapa, Pessoa } from "@/components/Icones";
import { contexto } from "@/lib/app";
import { formatarCnpj } from "@/lib/cnpj";
import { UFS } from "@/lib/ufs";

export const metadata = { title: "Base comum" };

const POR_PAGINA = 24;

export default async function Base({ searchParams }: PageProps<"/base">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const uf = typeof sp.uf === "string" ? sp.uf.toUpperCase().slice(0, 2) : "";
  const pagina = Math.max(0, Number(typeof sp.p === "string" ? sp.p : 0) || 0);
  const { servicos } = await contexto();
  const { itens, total } = await servicos.listarBase({ q, uf, pagina });
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const href = (p: number) => `/base?${new URLSearchParams({ ...(q && { q }), ...(uf && { uf }), p: String(p) })}`;
  const semEsse = (k: "q" | "uf") => `/base${k === "q" && uf ? `?uf=${uf}` : k === "uf" && q ? `?q=${encodeURIComponent(q)}` : ""}`;
  const filtrando = Boolean(q || uf);

  return (
    <div className="space-y-5">
      <header className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Base comum</h1>
          <p className="sub-pagina max-w-2xl">
            Empresas já pesquisadas por qualquer usuário. O que é descoberto fica aqui e pode ser reaproveitado e corrigido por todos: buscas repetidas custam menos e ficam mais completas.
          </p>
        </div>
        <div className="kpi min-w-36 text-center">
          <p className="kpi-valor">{total.toLocaleString("pt-BR")}</p>
          <p className="kpi-rotulo">{filtrando ? "encontradas" : "empresas na base"}</p>
        </div>
      </header>

      <form className="cartao grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end" role="search">
        <label className="min-w-0">
          <span className="rotulo">Buscar na base</span>
          <input name="q" defaultValue={q} className="input mt-1" placeholder="Nome, atividade, cidade ou início do CNPJ" />
        </label>
        <label>
          <span className="rotulo">Estado</span>
          <select name="uf" defaultValue={uf} className="input mt-1">
            <option value="">Todos</option>
            {UFS.map(([sigla, nome]) => <option key={sigla} value={sigla}>{sigla} · {nome}</option>)}
          </select>
        </label>
        <button className="btn-primario"><Busca width={16} height={16} /> Filtrar</button>
      </form>

      {filtrando && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
          {q && <Link href={semEsse("q")} className="chip-ativo" title="Remover">Busca: {q} <span aria-hidden>×</span></Link>}
          {uf && <Link href={semEsse("uf")} className="chip-ativo" title="Remover">Estado: {uf} <span aria-hidden>×</span></Link>}
          <Link href="/base" className="text-sm text-slate-600 underline">Limpar tudo</Link>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="vazio">
          <IconeBase width={34} height={34} className="text-slate-400" />
          <p className="font-medium text-tinta">{filtrando ? "Nada com esses filtros" : "A base ainda está vazia"}</p>
          <p>{filtrando ? "Tente outra palavra ou remova um filtro." : "Pesquise uma empresa e ela entra aqui para todos reaproveitarem."}</p>
          <Link href="/pesquisar" className="btn-primario mt-1">Pesquisar uma empresa</Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {itens.map((e) => {
            const nome = e.nomeFantasia || e.razaoSocial;
            const contatos = e.noPool + e.daComunidade;
            return (
              <li key={e.cnpj}>
                <Link href={`/base/${e.cnpj}`} className="cartao flex h-full flex-col gap-3 transition hover:border-marca-200 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-lg font-semibold text-marca-700" aria-hidden>{nome.charAt(0)}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{nome}</p>
                      <p className="truncate text-xs text-slate-500">{formatarCnpj(e.cnpj)}</p>
                    </div>
                  </div>
                  {e.atividade && <p className="line-clamp-2 text-sm text-slate-600">{e.atividade}</p>}
                  <div className="mt-auto flex flex-wrap gap-1.5 text-xs">
                    {e.municipio && <span className="selo-cinza"><Mapa width={12} height={12} className="mr-1" />{e.municipio}/{e.uf}</span>}
                    {contatos > 0 && <span className="selo"><Pessoa width={12} height={12} className="mr-1" />{contatos} contato(s)</span>}
                    {e.dominio && <span className="selo-cinza"><Externo width={12} height={12} className="mr-1" />{e.dominio}</span>}
                    {e.tags.map((t) => <span key={t} className="selo-cinza">#{t}</span>)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Paginacao pagina={pagina} paginas={paginas} href={href} />
    </div>
  );
}
