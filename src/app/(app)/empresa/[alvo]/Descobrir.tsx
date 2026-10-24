"use client";

import { useEffect, useRef, useState } from "react";
import { Pessoa } from "@/components/Icones";
import { classificarCargo, pesoDoCargo } from "@/lib/cargos";
import { formatarCnpj } from "@/lib/cnpj";
import { AbaResumo } from "./AbaResumo";
import { AbaSocios } from "./AbaSocios";
import { Enriquecimento, useEnriquecimento } from "./Enriquecimento";
import { FILTRO_VAZIO, ListaPessoas, type FiltroPessoas } from "./ListaPessoas";
import { chamar, creditos, type Busca, type Candidato, type Contato, type Empresa, type Sinal } from "./tipos";

export default function Descobrir({ cnpjInicial = "", iaAtiva = false, custos = { busca: 1, email: 1, telefone: 1 } }: { cnpjInicial?: string; iaAtiva?: boolean; custos?: { busca: number; email: number; telefone: number } }) {
  const [cnpj, setCnpj] = useState(cnpjInicial);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [siteBuscado, setSiteBuscado] = useState("");
  const [filtro, setFiltro] = useState<FiltroPessoas>(FILTRO_VAZIO);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [listaNome, setListaNome] = useState("");
  const [aviso, setAviso] = useState("");
  const [sinais, setSinais] = useState<Sinal[]>([]);
  const [busca, setBusca] = useState<Busca | null>(null);
  const [disponiveis, setDisponiveis] = useState<number | null>(null);
  const [aba, setAba] = useState<"resumo" | "pessoas" | "extras" | "socios">("resumo");
  const extras = useEnriquecimento(empresa?.cnpj);
  const abasRef = useRef<HTMLDivElement>(null);
  // Cada carga de empresa tem um número; respostas de uma carga antiga (a pessoa já abriu outra empresa) são descartadas.
  const cargaAtual = useRef(0);

  // Guarda o estado da busca e, ao concluir, mostra os contatos.
  function aplicarBusca(b: Busca | null, rolar = false) {
    setBusca(b);
    if (b?.status !== "concluida") return;
    setContatos(b.contatos ?? []);
    setAba("pessoas");
    // No celular as abas ficam abaixo da dobra: leva a tela até elas para o resultado não passar despercebido.
    if (rolar) setTimeout(() => abasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    if (b.saldo !== undefined) setSaldo(b.saldo);
    if ((b.contatos ?? []).length === 0) setAviso("Nenhuma pessoa encontrada nas fontes ligadas (quadro societário e site). O crédito foi devolvido. Para achar mais gente, ligue as fontes extras em Plataforma › IA (chaves Tavily e Hunter).");
  }

  // Acompanha a busca em segundo plano: consulta o andamento a cada 2 s até concluir.
  const buscaId = busca?.id;
  const emAndamento = busca?.status === "em_andamento";
  useEffect(() => {
    if (!buscaId || !emAndamento) return;
    const t = setTimeout(async () => {
      try {
        aplicarBusca(await chamar<Busca>(`/api/decisores/busca/${buscaId}`), true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado.");
        setBusca(null);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [buscaId, emAndamento, busca?.etapa]);

  async function executar(fn: () => Promise<void>) {
    setErro("");
    setAviso("");
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  const carregar = async (cnpjEscolhido: string, site?: string) => {
    const q = encodeURIComponent(cnpjEscolhido);
    const minha = ++cargaAtual.current;
    const atual = () => cargaAtual.current === minha;
    setCnpj(cnpjEscolhido);
    setCandidatos(null);
    setAba("resumo");
    setContatos([]);
    setBusca(null);
    setSinais([]);
    setDisponiveis(null);
    setFiltro(FILTRO_VAZIO);
    const ficha = await chamar<Empresa>(`/api/empresa?cnpj=${q}${site ? `&site=${encodeURIComponent(site)}` : ""}`);
    if (!atual()) return;
    setEmpresa(ficha);
    // O resto é complemento: se falhar, a ficha continua na tela.
    const [sin, disp, ultima, colhidas] = await Promise.all([
      chamar<Sinal[]>(`/api/sinais?cnpj=${q}`).catch(() => [] as Sinal[]),
      chamar<{ disponiveis: number }>(`/api/decisores/disponiveis?cnpj=${q}`).catch(() => ({ disponiveis: 0 })),
      // Retoma uma busca recente (em andamento ou concluída) desta empresa.
      chamar<Busca | null>(`/api/decisores/busca?cnpj=${q}`).catch(() => null),
      // Tudo o que a organização já colheu para esta empresa, de qualquer busca antiga (sem custo).
      chamar<Contato[]>(`/api/empresa/pessoas?cnpj=${q}`).catch(() => [] as Contato[]),
    ]);
    if (!atual()) return;
    setSinais(sin);
    setDisponiveis(disp.disponiveis);
    aplicarBusca(ultima);
    if (colhidas.length > 0) {
      setContatos(colhidas);
      setAba("pessoas");
    }
  };

  // Chegou por um link (ex.: "Ver decisores" na pesquisa): já carrega a empresa, sem exigir outro clique.
  const autoCarregado = useRef(false);
  useEffect(() => {
    if (autoCarregado.current || !cnpjInicial) return;
    autoCarregado.current = true;
    setTimeout(() => {
      const entrada = cnpjInicial.trim();
      const digitos = entrada.replace(/\D/g, "");
      const alvo = digitos.length === 14 ? digitos : entrada.startsWith("site:") ? entrada : "";
      if (alvo) void executar(() => carregar(alvo));
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpjInicial]);

  const acharCnpj = () => {
    const dominio = cnpj.replace(/^site:/, "");
    void executar(async () => {
      const r = await chamar<{ dominio: string; candidatos: Candidato[] }>(`/api/empresa?site=${encodeURIComponent(dominio)}`);
      setSiteBuscado(r.dominio);
      if (r.candidatos.length === 0) throw new Error("Nenhum CNPJ encontrado nesse site. Você pode seguir pesquisando só pelo site.");
      setCandidatos(r.candidatos);
    });
  };

  const visiveis = contatos
    .filter((c) => {
      const k = classificarCargo(c.cargo);
      const t = filtro.texto.trim().toLowerCase();
      return (
        (!filtro.depto || k.departamento === filtro.depto) &&
        (!filtro.senior || k.senioridade === filtro.senior) &&
        (!filtro.soEmail || c.temEmail) &&
        (!filtro.soTel || c.temTelefone) &&
        (!t || `${c.nome} ${c.cargo}`.toLowerCase().includes(t))
      );
    })
    .sort((a, b) => b.confianca * 0.6 + pesoDoCargo(b.cargo) * 0.4 - (a.confianca * 0.6 + pesoDoCargo(a.cargo) * 0.4));

  const buscarDecisores = () =>
    executar(async () => {
      setContatos([]);
      aplicarBusca(
        await chamar<Busca>("/api/decisores/busca", {
          cnpj,
          cargos: [],
          chave: crypto.randomUUID(),
        }),
        true,
      );
    });

  const revelar = (contatoId: string, campo: "email" | "telefone") =>
    executar(async () => {
      const r = await chamar<{ contato: Contato; saldo: number }>("/api/revelar", {
        contatoId,
        campo,
      });
      setContatos((atual) => atual.map((c) => (c.id === contatoId ? r.contato : c)));
      setSaldo(r.saldo);
    });

  const salvarEmLista = () =>
    executar(async () => {
      const lista = await chamar<{ id: string; nome: string }>("/api/listas", { nome: listaNome });
      await chamar("/api/listas", { listaId: lista.id, contatoIds: visiveis.map((c) => c.id) });
      setAviso(`${visiveis.length} pessoas de ${nome} salvas na lista "${lista.nome}".`);
      setListaNome("");
    });

  const cnpjFmt = empresa?.cnpj.startsWith("site:") ? "Sem CNPJ (pesquisa pelo site)" : empresa ? formatarCnpj(empresa.cnpj) : undefined;
  const nome = empresa ? (empresa.nomeFantasia?.trim() || empresa.razaoSocial) : "";
  const abas: { id: typeof aba; rotulo: string; n?: number }[] = [
    { id: "resumo", rotulo: "Resumo" },
    { id: "pessoas", rotulo: "Pessoas", n: contatos.length || undefined },
    { id: "extras", rotulo: "Extras" },
    { id: "socios", rotulo: "Sócios", n: empresa?.socios.length || undefined },
  ];

  return (
    <div className="space-y-5">
      {saldo !== null && <p className="selo w-fit">Saldo: {saldo} créditos</p>}

      {erro && (
        <div role="alert" className="aviso-erro flex flex-wrap items-center justify-between gap-2">
          <span>{erro}</span>
          {!empresa && cnpjInicial && <button type="button" className="btn-sec" onClick={() => void executar(() => carregar(cnpjInicial))}>Tentar de novo</button>}
        </div>
      )}
      {aviso && <p className="aviso-ok">{aviso}</p>}

      {candidatos && (
        <section className="cartao space-y-3 text-sm">
          <p className="font-medium">Encontrei mais de um CNPJ em {siteBuscado}. Qual é a empresa?</p>
          <ul className="space-y-2">
            {candidatos.map((c) => (
              <li key={c.cnpj} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                <span>
                  <b>{c.nomeFantasia ?? c.razaoSocial}</b>
                  <span className="text-slate-500"> · {c.cnpj}{c.municipio && ` · ${c.municipio}/${c.uf}`}</span>
                </span>
                <button type="button" disabled={ocupado} onClick={() => void executar(() => carregar(c.cnpj, siteBuscado))} className="btn-sec">Esta</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!empresa && ocupado && <div className="esqueleto h-40" aria-busy="true" aria-label="Carregando a empresa" />}

      {empresa && (
        <>
          <section className="cartao space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-marca-50 text-2xl font-semibold text-marca-700" aria-hidden>{nome.charAt(0)}</span>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight">{nome}</h2>
                  {empresa.nomeFantasia?.trim() && <p className="break-words text-sm text-slate-500">{empresa.razaoSocial}</p>}
                  <p className="text-sm font-medium text-slate-600">{cnpjFmt}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <span className="selo">{empresa.situacao}</span>
                    {empresa.matriz !== undefined && <span className="selo-cinza">{empresa.matriz ? "Matriz" : "Filial"}</span>}
                    {empresa.porte && <span className="selo-cinza">{empresa.porte}</span>}
                    {empresa.mei && <span className="selo-cinza bg-amber-100 text-amber-900">MEI</span>}
                    {empresa.simples && <span className="selo-cinza bg-amber-100 text-amber-900">Simples Nacional</span>}
                    {extras.dados?.cvm && <span className="selo">Companhia aberta</span>}
                    {!!extras.dados?.sancoes?.length && <span className="selo-cinza bg-red-100 text-red-800">Com sanção federal</span>}
                  </div>
                  {empresa.cnpj.startsWith("site:") && (
                    <p className="mt-2 text-sm text-slate-600">
                      Pesquisando só pelo site, sem CNPJ.{" "}
                      <button type="button" disabled={ocupado} onClick={acharCnpj} className="text-marca-700 underline">Procurar o CNPJ deste site</button>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                <button onClick={buscarDecisores} disabled={ocupado || emAndamento} className="btn-destaque w-full lg:w-auto">
                  <Pessoa width={18} height={18} /> Buscar pessoas ({creditos(custos.busca)})
                </button>
                <p className="max-w-xs text-xs text-slate-500 lg:text-right">
                  {disponiveis !== null && disponiveis > 0 && !busca
                    ? `${disponiveis} contato${disponiveis > 1 ? "s" : ""} de buscas anteriores serão reaproveitados (mesmo custo, resultado mais rápido). O crédito volta se nada for encontrado.`
                    : "Reúne sócios, site e fontes extras de uma vez. O crédito volta se nada for encontrado; revelar e-mail e telefone é cobrado à parte."}
                </p>
              </div>
            </div>

            {busca && busca.status !== "concluida" && (
              <div role="status" className={`rounded-xl p-3 text-sm ${busca.status === "erro" ? "bg-red-50 text-red-700" : "bg-marca-50 text-marca-900"}`}>
                {busca.status === "em_andamento" ? (
                  <>
                    <p className="flex items-center gap-2 font-medium"><span aria-hidden><span className="pontinho" /><span className="pontinho" /><span className="pontinho" /></span>{busca.etapa}…</p>
                    <p className="mt-1 text-xs">Costuma levar alguns segundos. Pode sair desta tela: a busca continua e, ao voltar, o resultado aparece.</p>
                  </>
                ) : (
                  <p>{busca.erro ?? "A busca falhou."} O crédito foi devolvido.</p>
                )}
              </div>
            )}
            {busca?.status === "concluida" && busca.doPool && <p className="text-xs text-slate-500">Resultado reaproveitado de uma varredura recente.</p>}
          </section>

          <div ref={abasRef} role="tablist" aria-label="Seções da empresa" className="scroll-mt-16 -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 md:mx-0 md:px-0">
            {abas.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={aba === a.id}
                tabIndex={aba === a.id ? 0 : -1}
                onClick={() => setAba(a.id)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const i = abas.findIndex((x) => x.id === a.id);
                  const prox = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
                  setAba(prox.id);
                  (e.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=tab]")[abas.indexOf(prox)])?.focus();
                }}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition sm:gap-2 sm:px-4 ${aba === a.id ? "border-marca-700 text-marca-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {a.rotulo}
                {a.n !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a.n}</span>}
              </button>
            ))}
          </div>

          {aba === "resumo" && <AbaResumo empresa={empresa} extras={extras} sinais={sinais} />}

          {aba === "extras" && <Enriquecimento {...extras} />}

          {aba === "socios" && <AbaSocios empresa={empresa} nome={nome} />}

          {aba === "pessoas" && contatos.length === 0 && (
            <div className="vazio">
              <Pessoa width={32} height={32} className="text-slate-400" />
              <p className="font-medium text-tinta">Nenhuma pessoa carregada ainda</p>
              <p>Clique em “Buscar pessoas” acima. Só cobramos o crédito se houver resultado.</p>
            </div>
          )}
        </>
      )}

      {empresa && aba === "pessoas" && contatos.length > 0 && (
        <ListaPessoas nome={nome} cnpjFmt={cnpjFmt} contatos={contatos} visiveis={visiveis} filtro={filtro} setFiltro={setFiltro} custos={custos} iaAtiva={iaAtiva} ocupado={ocupado} revelar={(id, campo) => void revelar(id, campo)} listaNome={listaNome} setListaNome={setListaNome} salvarEmLista={() => void salvarEmLista()} />
      )}
    </div>
  );
}
