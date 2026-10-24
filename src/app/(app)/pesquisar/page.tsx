import { ROTULO_DIMENSAO, type Dimensao } from "@/lib/aderencia";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { consultaPermitida, contexto } from "@/lib/app";
import { LimiteDeConsultas } from "@/components/LimiteDeConsultas";
import { emailConfigurado } from "@/lib/email";
import { limparFiltros, paraParametros, resumoFiltros } from "@/lib/filtrosUrl";
import { chaveGemini } from "@/lib/ia/gemini";
import { ABERTURAS, PORTES, SETORES } from "@/lib/setores";
import { Email, Externo, Importar, Predio, Relogio, Salvar, Sparkles, Telefone } from "@/components/Icones";
import { FORMATOS, ROTULO_FORMATO } from "@/lib/exportacao";
import { removerPesquisaAcao, salvarPesquisaAcao } from "../acoes";
import { Paginacao } from "@/components/Paginacao";
import { BuscaNatural } from "./BuscaNatural";
import { FiltrosPesquisa, type ValoresFiltro } from "./FiltrosPesquisa";

export const metadata = { title: "Pesquisar empresas" };
export const maxDuration = 60;

const POR_PAGINA = 25;

/** Atalhos para quem chega sem saber por onde começar. */
const EXEMPLOS: { rotulo: string; q: string }[] = [
  { rotulo: "Empresas abertas há menos de 1 ano no RJ", q: "uf=RJ&abertura=novas&ordem=recentes" },
  { rotulo: "Indústria de alimentos com telefone", q: "setor=alimentos&telefone=1" },
  { rotulo: "Clínicas e saúde em São Paulo", q: "uf=SP&setor=saude" },
  { rotulo: "Atacadistas de médio porte", q: "setor=atacado&porte=Demais" },
  { rotulo: "Tecnologia com e-mail cadastral", q: "setor=ti&email=1" },
];

/** Anos completos desde uma data (AAAA-MM-DD). */
const anosDesde = (d?: string) => (d ? Math.max(0, Math.floor((Date.now() - Date.parse(d)) / 31_557_600_000)) : undefined);

const lista = (sp: Record<string, string | string[] | undefined>, k: string) =>
  Array.isArray(sp[k]) ? (sp[k] as string[]) : typeof sp[k] === "string" ? [sp[k] as string] : [];
const texto = (sp: Record<string, string | string[] | undefined>, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

export default async function Pesquisar({ searchParams }: PageProps<"/pesquisar">) {
  await connection();
  if (!(await consultaPermitida())) return <LimiteDeConsultas />;
  const sp = await searchParams;
  const v: ValoresFiltro = {
    nome: texto(sp, "nome"), termos: texto(sp, "termos"), segmento: texto(sp, "segmento"),
    uf: texto(sp, "uf").toUpperCase().slice(0, 2), cidade: texto(sp, "cidade"), bairro: texto(sp, "bairro"),
    setores: lista(sp, "setor").filter((x) => SETORES.some((t) => t.id === x)),
    porte: lista(sp, "porte").filter((x) => (PORTES as readonly string[]).includes(x)),
    abertura: ABERTURAS.some((a) => a.id === sp.abertura) ? (sp.abertura as string) : "",
    email: sp.email === "1", telefone: sp.telefone === "1", filiais: sp.filiais === "1",
    ordem: sp.ordem === "recentes" ? "recentes" : sp.ordem === "aderencia" ? "aderencia" : "nome",
  };
  const pagina = Math.max(0, Number(texto(sp, "pagina")) || 0);
  const erro = texto(sp, "erro");
  const salva = sp.salva === "1";

  const filtros = limparFiltros({
    nome: v.nome, termos: v.termos, segmento: v.segmento, uf: v.uf, cidade: v.cidade, bairro: v.bairro, setores: v.setores, porte: v.porte,
    abertura: v.abertura, comEmail: v.email, comTelefone: v.telefone, ordem: v.ordem, incluirFiliais: v.filiais,
  });
  const buscou = Object.keys(filtros).filter((k) => k !== "ordem").length > 0;

  // Uma caixa só: se o que foi digitado é um CNPJ ou um site (e nada mais foi filtrado), abre a empresa direto.
  if (v.nome && Object.keys(filtros).every((k) => k === "nome" || k === "ordem")) {
    const digitos = v.nome.replace(/\D/g, "");
    if (digitos.length === 14 && !/[a-zA-Z]/.test(v.nome)) redirect(`/empresa/${digitos}`);
    const dominio = v.nome.trim().toLowerCase().replace(/^site:/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) redirect(`/empresa/${encodeURIComponent(`site:${dominio}`)}`);
  }
  // Endereço desta mesma pesquisa (com a página), para o botão "voltar" da página da empresa.
  const aqui = (() => {
    const q = new URLSearchParams();
    for (const [c, val] of Object.entries(sp)) for (const x of Array.isArray(val) ? val : val === undefined ? [] : [val]) if (c !== "erro" && c !== "salva" && c !== "aviso") q.append(c, x);
    return `/pesquisar${q.toString() ? `?${q}` : ""}`;
  })();
  const empresaHref = (alvo: string) => `/empresa/${encodeURIComponent(alvo)}?de=${encodeURIComponent(aqui)}`;

  // Filtros ativos como chips: cada um leva à mesma pesquisa sem aquele filtro.
  const semEsse = (k: string, valor?: string) => {
    const q = new URLSearchParams();
    for (const [c, val] of Object.entries(sp)) for (const x of Array.isArray(val) ? val : val === undefined ? [] : [val]) if (!(c === k && (valor === undefined || x === valor)) && c !== "pagina" && c !== "erro" && c !== "salva" && c !== "aviso") q.append(c, x);
    return `/pesquisar${q.toString() ? `?${q}` : ""}`;
  };
  const chips: { rotulo: string; href: string }[] = [
    ...(v.nome ? [{ rotulo: `Nome: ${v.nome}`, href: semEsse("nome") }] : []),
    ...(v.termos ? [{ rotulo: `Palavras: ${v.termos}`, href: semEsse("termos") }] : []),
    ...(v.segmento ? [{ rotulo: `Atividade: ${v.segmento}`, href: semEsse("segmento") }] : []),
    ...(v.uf ? [{ rotulo: `Estado: ${v.uf}`, href: semEsse("uf") }] : []),
    ...(v.cidade ? [{ rotulo: `Cidade: ${v.cidade}`, href: semEsse("cidade") }] : []),
    ...(v.bairro ? [{ rotulo: `Bairro: ${v.bairro}`, href: semEsse("bairro") }] : []),
    ...v.setores.map((s) => ({ rotulo: SETORES.find((t) => t.id === s)!.nome, href: semEsse("setor", s) })),
    ...v.porte.map((p) => ({ rotulo: p, href: semEsse("porte", p) })),
    ...(v.abertura ? [{ rotulo: `Aberta: ${ABERTURAS.find((a) => a.id === v.abertura)!.nome.toLowerCase()}`, href: semEsse("abertura") }] : []),
    ...(v.email ? [{ rotulo: "Com e-mail", href: semEsse("email") }] : []),
    ...(v.telefone ? [{ rotulo: "Com telefone", href: semEsse("telefone") }] : []),
    ...(v.filiais ? [{ rotulo: "Inclui filiais", href: semEsse("filiais") }] : []),
  ];

  const { servicos } = await contexto();
  const [salvas, cobertura, r] = await Promise.all([
    servicos.pesquisasSalvas(),
    servicos.cobertura().catch(() => []),
    servicos.pesquisar({ ...filtros, setores: v.setores, porte: v.porte, abertura: v.abertura || undefined, comEmail: v.email, comTelefone: v.telefone, ordem: v.ordem as "nome" | "recentes" | "aderencia", aderencia: true, incluirFiliais: v.filiais, pagina }),
  ]);

  const ufsBase = cobertura.map((c) => c.uf);
  const ufForaDaBase = v.uf && ufsBase.length > 0 && !ufsBase.includes(v.uf);
  const paramsAtuais = paraParametros(filtros);
  const href = (extra: Record<string, string>) => {
    const q = new URLSearchParams(paramsAtuais);
    for (const [k, val] of Object.entries(extra)) q.set(k, val);
    return `/pesquisar?${q}`;
  };
  const paginas = Math.max(1, Math.ceil(r.total / POR_PAGINA));
  const iaAtiva = Boolean(chaveGemini());

  return (
    <div className="space-y-5">
      <header className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Pesquisar empresas</h1>
          <p className="sub-pagina">Busque por nome, CNPJ ou site, ou filtre a base da Receita por atividade, local, porte e idade. Clique numa empresa para ver tudo sobre ela e os decisores.</p>
          {cobertura.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Base carregada: {cobertura.map((c) => `${c.uf} (${c.empresas.toLocaleString("pt-BR")} empresas)`).join(", ")}. Para outros estados, digite o CNPJ na caixa de busca acima: a empresa abre direto.
            </p>
          )}
        </div>
      </header>

      <form action="/pesquisar" role="search" className="cartao flex flex-col gap-2 sm:flex-row">
        {Object.entries(sp).flatMap(([c, val]) => (c === "nome" || c === "pagina" || c === "erro" || c === "salva" || c === "aviso" ? [] : (Array.isArray(val) ? val : val === undefined ? [] : [val]).map((x, i) => <input key={`${c}${i}`} type="hidden" name={c} value={x} />)))}
        <label htmlFor="busca-unica" className="sr-only">Nome da empresa, CNPJ ou site</label>
        <input id="busca-unica" name="nome" defaultValue={v.nome} placeholder="Nome, CNPJ ou site" className="input flex-1" autoComplete="off" />
        <button className="btn-primario">Buscar</button>
      </form>

      {iaAtiva && <BuscaNatural />}

      <div className="grid gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside>
          <FiltrosPesquisa valores={v} ativos={chips.length} />
        </aside>

        <section className="min-w-0 space-y-4" aria-live="polite">
          {erro && <p role="alert" className="aviso-erro">{erro}</p>}
          {salva && <p className="aviso-ok">Pesquisa salva.</p>}
          {sp.aviso === "ia" && <p className="aviso-erro border-amber-200 bg-amber-50 text-amber-800">A IA está indisponível agora; busquei pelo nome. Use os filtros ao lado para refinar.</p>}

          {buscou && !r.baseReceita && (
            <p className="cartao border-amber-300 bg-amber-50 text-sm">
              A base de estabelecimentos da Receita ainda não foi carregada, então só aparecem empresas e sites já pesquisados pela equipe. A carga é feita pelo workflow &quot;Importar Receita&quot; (veja o ESTADO.md).
            </p>
          )}

          {ufForaDaBase && (
            <div className="cartao border-amber-300 bg-amber-50 text-sm" role="note">
              <p className="font-medium text-amber-900">A base carregada ainda não tem {v.uf}.</p>
              <p className="mt-1 text-amber-900">Hoje ela cobre só {ufsBase.join(", ")}, por isso a pesquisa em {v.uf} volta vazia mesmo que a empresa exista. Opções:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                <li>Se você tem o CNPJ, digite-o na caixa de busca acima: a ficha abre direto e funciona para qualquer estado.</li>
                <li>Para trazer um recorte de {v.uf} (por nome ou CNPJ-raiz), use o workflow &quot;Importar Receita&quot; com os campos <code>busca</code> ou <code>raizes</code> (veja <code>docs/carregar-base.md</code>).</li>
              </ul>
            </div>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
              {chips.map((c) => (
                <Link key={c.rotulo} href={c.href} className="chip-ativo" title="Remover este filtro">
                  {c.rotulo} <span aria-hidden className="text-marca-600">×</span><span className="sr-only">remover</span>
                </Link>
              ))}
              <Link href="/pesquisar" className="text-sm text-slate-600 underline">Limpar tudo</Link>
            </div>
          )}

          {buscou ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  {r.totalAproximado && "mais de "}<strong className="text-base text-tinta">{r.total.toLocaleString("pt-BR")}</strong> empresa{r.total === 1 && !r.totalAproximado ? "" : "s"}
                  {r.total > 0 && <> · página {pagina + 1} de {paginas}</>}
                </p>
                <div className="flex items-center gap-2 text-sm" role="group" aria-label="Ordenar">
                  <Link href={href({ ordem: "nome", pagina: "0" })} className={v.ordem === "nome" ? "chip-ativo" : "chip"}>A–Z</Link>
                  <Link href={href({ ordem: "recentes", pagina: "0" })} className={v.ordem === "recentes" ? "chip-ativo" : "chip"}>Mais recentes</Link>
                  {r.temPerfil ? (
                    <Link href={href({ ordem: "aderencia", pagina: "0" })} className={v.ordem === "aderencia" ? "chip-ativo" : "chip"}>Aderência ao perfil</Link>
                  ) : (
                    <Link href="/configuracoes#perfil-ideal" className="chip" title="Defina o cliente ideal para ordenar por aderência">Definir perfil ideal</Link>
                  )}
                </div>
              </div>

              {r.total > 0 && (
                <details className="cartao p-0">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-marca-800 marker:hidden">
                    <Importar width={18} height={18} /> Exportar {r.totalAproximado ? "as primeiras " : "estas "}{r.total.toLocaleString("pt-BR")} empresas para planilha ou CRM
                  </summary>
                  <div className="space-y-2 border-t border-slate-100 p-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {FORMATOS.map((f) => (
                        <a key={f} className="btn-sec" href={`/api/pesquisar/exportar?${paramsAtuais}${paramsAtuais ? "&" : ""}formato=${f}`}>{f === "padrao" ? "CSV padrão" : ROTULO_FORMATO[f]}</a>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">
                      Dados públicos da Receita (não gasta crédito). Cada arquivo leva até 5.000 empresas{r.total > 5000 ? `; para as demais, acrescente &pagina=1, 2…` : ""}. Contatos de pessoas saem das listas, depois de revelados.
                    </p>
                  </div>
                </details>
              )}

              <details className="cartao group p-0">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-marca-800 marker:hidden">
                  <Salvar width={18} height={18} /> Salvar esta pesquisa e receber avisos de empresas novas
                </summary>
                <form action={salvarPesquisaAcao} className="flex flex-col gap-2 border-t border-slate-100 p-4 text-sm sm:flex-row sm:items-center">
                  <input type="hidden" name="filtros" value={JSON.stringify(filtros)} />
                  <input type="hidden" name="volta" value={paramsAtuais} />
                  <input name="nome" required maxLength={80} placeholder="Nome da pesquisa" className="input flex-1" aria-label="Nome da pesquisa" />
                  <label className="flex items-center gap-2"><input type="checkbox" name="avisar" value="1" defaultChecked /> Avisar por e-mail</label>
                  <button className="btn-primario">Salvar</button>
                </form>
              </details>

              {r.sites.length > 0 && (
                <div className="cartao space-y-2">
                  <h2 className="secao-titulo">Sites já conhecidos</h2>
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {r.sites.map((s) => (
                      <li key={s}><Link className="chip" href={empresaHref("site:" + s)}>{s}</Link></li>
                    ))}
                  </ul>
                </div>
              )}

              {r.itens.length === 0 ? (
                <div className="vazio">
                  <Predio width={32} height={32} className="text-slate-400" />
                  <p className="font-medium text-tinta">Nenhuma empresa com esses filtros</p>
                  <p>{ufForaDaBase ? `A base carregada não tem ${v.uf}; veja o aviso acima.` : "Tente remover algum filtro (use os chips acima) ou ampliar a localização."}</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {r.itens.map((i) => {
                    const anos = anosDesde(i.abertaEm);
                    const nome = i.nomeFantasia || i.razaoSocial;
                    return (
                      <li key={i.cnpj} className="cartao flex flex-col gap-3 transition hover:border-marca-200 hover:shadow-md sm:flex-row sm:items-center">
                        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-lg font-semibold text-marca-700 sm:flex" aria-hidden>{nome.charAt(0)}</span>
                        <div className="min-w-0 flex-1">
                          <Link href={empresaHref(i.cnpj)} className="block truncate font-semibold text-marca-800 hover:underline">{nome}</Link>
                          <p className="truncate text-xs text-slate-500">{i.razaoSocial} · {i.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</p>
                          <p className="mt-1 truncate text-sm text-slate-600">{[i.bairro, i.municipio, i.uf].filter(Boolean).join(" · ")}{i.atividade ? ` — ${i.atividade}` : ""}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                            {i.aderencia !== undefined && (
                              <span className={i.aderencia >= 70 ? "selo" : "selo-cinza"} title={(i.motivos ?? []).map((m) => `${ROTULO_DIMENSAO[m.dimensao as Dimensao]}: ${m.ok ? "combina" : "não combina"}`).join(" · ")}>
                                {i.aderencia}% aderente
                              </span>
                            )}
                            {i.porte && <span className="selo-cinza">{i.porte}</span>}
                            {anos !== undefined && <span className="selo-cinza"><Relogio width={12} height={12} className="mr-1" />{anos < 1 ? "menos de 1 ano" : `${anos} ano${anos > 1 ? "s" : ""}`}</span>}
                            {!i.matriz && <span className="selo-cinza">Filial</span>}
                            {i.temEmail && <span className="selo"><Email width={12} height={12} className="mr-1" />e-mail cadastral</span>}
                            {i.temTelefone && <span className="selo"><Telefone width={12} height={12} className="mr-1" />telefone cadastral</span>}
                            {i.dominio && <Link href={empresaHref("site:" + i.dominio)} className="selo"><Externo width={12} height={12} className="mr-1" />{i.dominio}</Link>}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:self-center">
                          <Link href={empresaHref(i.cnpj)} className="btn-sec">Abrir empresa</Link>
                          <Link href={`/parecidas?cnpj=${i.cnpj}`} className="text-center text-xs text-marca-700 underline">Empresas parecidas</Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Paginacao pagina={pagina} paginas={paginas} href={(i) => href({ pagina: String(i) })} />
            </>
          ) : (
            <div className="space-y-5">
              <div className="cartao-destaque space-y-3">
                <h2 className="flex items-center gap-2 font-semibold text-marca-800"><Sparkles width={18} height={18} /> Comece por um destes atalhos</h2>
                <div className="flex flex-wrap gap-2">
                  {EXEMPLOS.map((e) => <Link key={e.q} href={`/pesquisar?${e.q}`} className="chip">{e.rotulo}</Link>)}
                </div>
                <p className="text-sm text-slate-600">
                  {iaAtiva ? "Ou descreva em português no campo acima. " : ""}Use os filtros ao lado: eles se aplicam sozinhos ao escolher uma opção.
                </p>
              </div>
            </div>
          )}

          {salvas.length > 0 && (
            <div className="cartao space-y-2">
              <h2 className="secao-titulo">Pesquisas salvas</h2>
              {!emailConfigurado() && <p className="text-xs text-slate-500">O envio de e-mail ainda não está configurado: os avisos só começam depois que o operador configurar o Resend.</p>}
              <ul className="divide-y divide-slate-100 text-sm">
                {salvas.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <Link className="font-medium text-marca-700 hover:underline" href={`/pesquisar?${paraParametros(p.filtros)}`}>{p.nome}</Link>
                      <span className="block truncate text-xs text-slate-500">{resumoFiltros(p.filtros)} · {p.avisar ? `aviso ligado (último ${p.ultimoAviso})` : "sem aviso"}</span>
                    </span>
                    <form action={removerPesquisaAcao}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="volta" value={paramsAtuais} />
                      <button className="text-xs text-slate-500 underline">Remover</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
