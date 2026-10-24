import Link from "next/link";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { formatarCnpj } from "@/lib/cnpj";
import { Email, Listas as Lista, Pessoa, Predio, Relogio, Telefone } from "@/components/Icones";

export const metadata = { title: "Minhas empresas" };

const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default async function MinhasEmpresas({ searchParams }: PageProps<"/empresas">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const { servicos } = await contexto();
  const empresas = await servicos.empresasTrabalhadas({ q });
  const total = q ? (await servicos.empresasTrabalhadas({})).length : empresas.length;
  const pessoas = empresas.reduce((t, e) => t + e.pessoas, 0);
  const revelados = empresas.reduce((t, e) => t + e.emailsRevelados + e.telefonesRevelados, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="titulo-pagina">Minhas empresas</h1>
        <p className="sub-pagina">Todas as empresas em que a sua equipe já pesquisou, com as pessoas e os dados colhidos de cada uma. Clique para ver tudo.</p>
      </header>

      {total > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="kpi"><p className="kpi-valor">{total}</p><p className="kpi-rotulo">empresas</p></div>
            <div className="kpi"><p className="kpi-valor">{pessoas}</p><p className="kpi-rotulo">pessoas colhidas{q ? " (neste filtro)" : ""}</p></div>
            <div className="kpi"><p className="kpi-valor">{revelados}</p><p className="kpi-rotulo">contatos revelados{q ? " (neste filtro)" : ""}</p></div>
          </div>
          <form role="search" action="/empresas" className="cartao flex flex-col gap-2 sm:flex-row">
            <label htmlFor="q-empresas" className="sr-only">Filtrar minhas empresas</label>
            <input id="q-empresas" name="q" defaultValue={q} placeholder="Filtrar por nome, cidade ou CNPJ" className="input flex-1" autoComplete="off" />
            <button className="btn-primario">Filtrar</button>
            {q && <Link href="/empresas" className="btn-sec">Limpar</Link>}
          </form>
        </>
      )}

      {empresas.length === 0 ? (
        <div className="vazio">
          <Predio width={36} height={36} className="text-slate-400" />
          {total === 0 ? (
            <>
              <p className="font-medium text-tinta">Você ainda não abriu nenhuma empresa</p>
              <p>Pesquise uma empresa e use “Buscar pessoas”: ela aparece aqui, com tudo o que foi colhido.</p>
              <Link href="/pesquisar" className="btn-primario">Pesquisar empresas</Link>
            </>
          ) : (
            <p className="font-medium text-tinta">Nenhuma empresa combina com “{q}”</p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {empresas.map((e) => (
            <li key={e.cnpj}>
              <Link href={`/empresa/${encodeURIComponent(e.cnpj)}?de=${encodeURIComponent("/empresas")}`} className="cartao flex flex-col gap-3 transition hover:border-marca-200 hover:shadow-md sm:flex-row sm:items-center">
                <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-lg font-semibold text-marca-700 sm:flex" aria-hidden>{e.nome.charAt(0)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold text-marca-800">{e.nome}</span>
                  <span className="block text-xs text-slate-500">{formatarCnpj(e.cnpj)}{e.razaoSocial && e.razaoSocial !== e.nome ? ` · ${e.razaoSocial}` : ""}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{[e.municipio && `${e.municipio}${e.uf ? `/${e.uf}` : ""}`, e.porte, e.atividade].filter(Boolean).join(" · ") || "Dados cadastrais ainda não carregados"}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <span className={e.pessoas ? "selo" : "selo-cinza"}><Pessoa width={12} height={12} className="mr-1" />{e.pessoas} pessoa{e.pessoas === 1 ? "" : "s"}</span>
                    {e.emailsRevelados > 0 && <span className="selo"><Email width={12} height={12} className="mr-1" />{e.emailsRevelados} e-mail{e.emailsRevelados === 1 ? "" : "s"} revelado{e.emailsRevelados === 1 ? "" : "s"}</span>}
                    {e.telefonesRevelados > 0 && <span className="selo"><Telefone width={12} height={12} className="mr-1" />{e.telefonesRevelados} telefone{e.telefonesRevelados === 1 ? "" : "s"} revelado{e.telefonesRevelados === 1 ? "" : "s"}</span>}
                    {e.listas > 0 && <span className="selo-cinza"><Lista width={12} height={12} className="mr-1" />em {e.listas} lista{e.listas === 1 ? "" : "s"}</span>}
                    {e.ultimaBusca === "em_andamento" && <span className="selo">Buscando pessoas…</span>}
                    {e.ultimaBusca === "erro" && e.pessoas === 0 && <span className="selo-cinza bg-red-100 text-red-800">Última busca sem resultado</span>}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500"><Relogio width={12} height={12} />{quando(e.ultimaAtividade)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
