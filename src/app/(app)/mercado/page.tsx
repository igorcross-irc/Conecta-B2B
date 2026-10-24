import Link from "next/link";
import { connection } from "next/server";
import { consultaPermitida, contexto } from "@/lib/app";
import { filtrosDaUrl, paraBusca } from "@/lib/consulta";
import { LimiteDeConsultas } from "@/components/LimiteDeConsultas";
import { paraParametros } from "@/lib/filtrosUrl";
import { PORTES, SETORES } from "@/lib/setores";
import { UFS } from "@/lib/ufs";
import type { Fatia } from "@/lib/servicosPg";

export const metadata = { title: "Mercado" };

const num = (n: number) => n.toLocaleString("pt-BR");

const EXEMPLOS = [
  { rotulo: "Alimentos e bebidas no RJ", q: "uf=RJ&setor=alimentos" },
  { rotulo: "Tecnologia no RJ", q: "uf=RJ&setor=ti" },
  { rotulo: "Saúde em Niterói", q: "uf=RJ&cidade=Niteroi&setor=saude" },
];

/** Barras horizontais em CSS puro (sem biblioteca de gráficos): o rótulo, a barra proporcional ao maior valor e a participação. */
function Barras({ titulo, itens, total, href }: { titulo: string; itens: Fatia[]; total: number; href?: (f: Fatia) => string }) {
  const maior = Math.max(1, ...itens.map((i) => i.empresas));
  return (
    <section className="cartao space-y-3">
      <h2 className="secao-titulo">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">Sem dados.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((i) => {
            const conteudo = (
              <>
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{i.rotulo}</span>
                  <span className="shrink-0 tabular-nums text-slate-600">{num(i.empresas)} <span className="text-xs text-slate-400">({total ? Math.round((100 * i.empresas) / total) : 0}%)</span></span>
                </span>
                <span className="mt-1 block h-2 rounded-full bg-slate-100" aria-hidden>
                  <span className="block h-2 rounded-full bg-marca-600" style={{ width: `${Math.max(2, (100 * i.empresas) / maior)}%` }} />
                </span>
              </>
            );
            return <li key={i.chave}>{href ? <Link href={href(i)} className="block rounded-lg p-1 hover:bg-marca-50" title="Ver estas empresas na Pesquisa">{conteudo}</Link> : conteudo}</li>;
          })}
        </ul>
      )}
    </section>
  );
}

export default async function Mercado({ searchParams }: PageProps<"/mercado">) {
  await connection();
  if (!(await consultaPermitida())) return <LimiteDeConsultas />;
  const sp = await searchParams;
  const url = filtrosDaUrl(paraBusca(sp));
  const f = { uf: url.uf ?? "", cidade: url.cidade ?? "", segmento: url.segmento ?? "", setores: url.setores ?? [], porte: url.porte ?? [], abertura: url.abertura ?? "" };
  const { servicos } = await contexto();
  const m = await servicos.mercado({ ...f, abertura: f.abertura || undefined });
  const base = paraParametros({ ...f, abertura: f.abertura || undefined });
  const pesquisa = (extra: string) => `/pesquisar?${[base, extra].filter(Boolean).join("&")}`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="titulo-pagina">Mercado</h1>
        <p className="sub-pagina">Quantas empresas existem no recorte que você escolher e como elas se distribuem. Dados públicos da Receita, sem gastar crédito.</p>
      </header>

      <form className="cartao grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/mercado">
        <label className="block text-sm">
          <span className="rotulo">Estado</span>
          <select name="uf" defaultValue={f.uf} className="input mt-1">
            <option value="">Todos</option>
            {UFS.map(([sigla, nome]) => <option key={sigla} value={sigla}>{sigla} · {nome}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="rotulo">Cidade</span>
          <input name="cidade" defaultValue={f.cidade} className="input mt-1" placeholder="Ex.: Niterói" />
        </label>
        <label className="block text-sm">
          <span className="rotulo">Setor</span>
          <select name="setor" defaultValue={f.setores[0] ?? ""} className="input mt-1">
            <option value="">Todos</option>
            {SETORES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="rotulo">Porte</span>
          <select name="porte" defaultValue={f.porte[0] ?? ""} className="input mt-1">
            <option value="">Todos</option>
            {PORTES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
          <button className="btn-primario">Ver mercado</button>
          <Link href="/mercado" className="text-sm text-slate-600 underline">Limpar</Link>
        </div>
      </form>

      {!m ? (
        <div className="cartao-destaque space-y-3">
          <h2 className="font-semibold text-marca-800">Escolha um recorte para começar</h2>
          <p className="text-sm text-slate-600">Informe ao menos um filtro (estado, cidade, setor ou porte), ou use um atalho:</p>
          <div className="flex flex-wrap gap-2">{EXEMPLOS.map((e) => <Link key={e.q} href={`/mercado?${e.q}`} className="chip">{e.rotulo}</Link>)}</div>
        </div>
      ) : (
        <>
          {!m.baseReceita && <p className="aviso-erro">A base da Receita ainda não foi carregada; os números aparecem quando ela existir (ver Plataforma › Saúde).</p>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="kpi"><p className="kpi-valor">{num(m.total)}</p><p className="kpi-rotulo">empresas ativas (matrizes)</p></div>
            <div className="kpi"><p className="kpi-valor">{m.total ? Math.round((100 * m.comEmail) / m.total) : 0}%</p><p className="kpi-rotulo">com e-mail cadastral</p></div>
            <div className="kpi"><p className="kpi-valor">{m.total ? Math.round((100 * m.comTelefone) / m.total) : 0}%</p><p className="kpi-rotulo">com telefone cadastral</p></div>
            <Link href={pesquisa("")} className="kpi flex items-center justify-center text-center text-sm font-medium text-marca-800 hover:border-marca-300">Ver estas empresas na Pesquisa →</Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Barras titulo="Por setor" itens={m.porSetor} total={m.total} href={(i) => pesquisa(i.chave === "outros" ? "" : `setor=${i.chave}`)} />
            <Barras titulo="Por porte" itens={m.porPorte} total={m.total} href={(i) => pesquisa(`porte=${encodeURIComponent(i.chave)}`)} />
            <Barras titulo="Por cidade (as 15 maiores)" itens={m.porMunicipio} total={m.total} />
            {!f.uf && <Barras titulo="Por estado" itens={m.porUf} total={m.total} href={(i) => pesquisa(`uf=${i.chave}`)} />}
            <Barras titulo="Idade das empresas" itens={m.porIdade} total={m.total} />
            <Barras titulo="Aberturas por ano" itens={m.aberturasPorAno} total={m.total} />
          </div>
        </>
      )}
    </div>
  );
}
