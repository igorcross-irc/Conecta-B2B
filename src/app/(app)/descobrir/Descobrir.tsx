"use client";

import { Abordagem } from "./Abordagem";
import { Enriquecimento, useEnriquecimento } from "./Enriquecimento";
import { Busca as IconeBusca, Email, Externo, Mapa, Pessoa, Predio, Relogio, Telefone } from "@/components/Icones";
import { useEffect, useRef, useState } from "react";
import { DEPARTAMENTOS, SENIORIDADES, classificarCargo, pesoDoCargo } from "@/lib/cargos";

interface Empresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  porte?: string;
  naturezaJuridica?: string;
  capitalSocial?: number;
  municipio?: string;
  uf?: string;
  endereco?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string; cep?: string };
  abertaEm?: string;
  matriz?: boolean;
  simples?: boolean;
  mei?: boolean;
  cnaePrincipal?: { codigo?: number; descricao: string };
  cnaesSecundarios?: { codigo: number; descricao: string }[];
  telefones: string[];
  emailsCadastrais: string[];
  socios: { nome: string; qualificacao: string; desde?: string }[];
  dominio?: string;
  fonte: string;
  obtidoEm: string;
}

const dinheiro = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBr = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : undefined);
function idade(d?: string): string | undefined {
  if (!d) return undefined;
  const anos = (Date.now() - new Date(d).getTime()) / (365.25 * 864e5);
  return anos < 1 ? "menos de 1 ano" : `${Math.floor(anos)} ano${Math.floor(anos) > 1 ? "s" : ""}`;
}
const cepBr = (c?: string) => (c && c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);

interface Contato {
  id: string;
  nome: string;
  cargo: string;
  departamento?: string;
  senioridade?: string;
  temEmail: boolean;
  email?: string;
  emailMascarado?: string;
  emailStatus?: string;
  temTelefone: boolean;
  telefone?: string;
  telefoneMascarado?: string;
  linkedinUrl?: string;
  origem: string;
  obtidoEm: string;
  confianca: number;
}

const ROTULO_STATUS: Record<string, string> = {
  verificado: "verificado",
  nao_verificado: "não verificado",
  inferido: "inferido",
  dominio_ok: "domínio recebe e-mail",
};

async function chamar<T>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: corpo ? "POST" : "GET",
    headers: corpo ? { "Content-Type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro ?? "Erro inesperado.");
  return dados as T;
}

interface Sinal {
  id: string;
  tipo: string;
  fonte: string;
  ocorridoEm: string;
}

interface Busca {
  id: string;
  status: "em_andamento" | "concluida" | "erro";
  etapa: string;
  doPool: boolean;
  erro?: string;
  contatos?: Contato[];
  saldo?: number;
}

interface Candidato {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  municipio?: string;
  uf?: string;
  situacao?: string;
}

export default function Descobrir({ cnpjInicial = "", iaAtiva = false }: { cnpjInicial?: string; iaAtiva?: boolean }) {
  const [cnpj, setCnpj] = useState(cnpjInicial);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [siteBuscado, setSiteBuscado] = useState("");
  const [filtro, setFiltro] = useState({ depto: "", senior: "", soEmail: false, soTel: false, texto: "" });
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

  // Guarda o estado da busca e, ao concluir, mostra os contatos.
  function aplicarBusca(b: Busca | null) {
    setBusca(b);
    if (b?.status !== "concluida") return;
    setContatos(b.contatos ?? []);
    setAba("pessoas");
    // No celular as abas ficam abaixo da dobra: leva a tela até elas para o resultado não passar despercebido.
    setTimeout(() => abasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
        aplicarBusca(await chamar<Busca>(`/api/decisores/busca/${buscaId}`));
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
    setCnpj(cnpjEscolhido);
    setCandidatos(null);
    setAba("resumo");
    setEmpresa(await chamar<Empresa>(`/api/empresa?cnpj=${q}${site ? `&site=${encodeURIComponent(site)}` : ""}`));
    setSinais(await chamar<Sinal[]>(`/api/sinais?cnpj=${q}`));
    setDisponiveis((await chamar<{ disponiveis: number }>(`/api/decisores/disponiveis?cnpj=${q}`)).disponiveis);
    // Retoma uma busca recente (em andamento ou concluída) desta empresa.
    aplicarBusca(await chamar<Busca | null>(`/api/decisores/busca?cnpj=${q}`));
  };

  const buscarEmpresa = (e: React.FormEvent) => {
    e.preventDefault();
    setContatos([]);
    setBusca(null);
    setDisponiveis(null);
    setEmpresa(null);
    setCandidatos(null);
    void executar(async () => {
      const entrada = cnpj.trim();
      const digitos = entrada.replace(/\D/g, "");
      if (digitos.length === 14) return carregar(digitos);
      // Qualquer outra coisa é um site: o próprio endereço é o centralizador das buscas, sem exigir CNPJ.
      const dominio = entrada.toLowerCase().replace(/^site:/, "").replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/^www\./, "");
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) throw new Error("Informe um CNPJ (14 dígitos) ou o endereço do site (ex.: empresa.com.br).");
      return carregar(`site:${dominio}`);
    });
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
      await chamar("/api/listas", { listaId: lista.id, contatoIds: contatos.map((c) => c.id) });
      setAviso(`${contatos.length} contatos salvos na lista "${lista.nome}".`);
      setListaNome("");
    });

  const cnpjFmt = empresa?.cnpj.startsWith("site:") ? "Sem CNPJ (pesquisa pelo site)" : empresa?.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const nome = empresa ? (empresa.nomeFantasia ?? empresa.razaoSocial) : "";
  const enderecoTexto = empresa
    ? [empresa.endereco?.logradouro && `${empresa.endereco.logradouro}${empresa.endereco.numero ? `, ${empresa.endereco.numero}` : ""}`, empresa.endereco?.complemento, empresa.endereco?.bairro, empresa.municipio && `${empresa.municipio}${empresa.uf ? `/${empresa.uf}` : ""}`, empresa.endereco?.cep && `CEP ${cepBr(empresa.endereco.cep)}`].filter(Boolean).join(" · ")
    : "";
  const abas: { id: typeof aba; rotulo: string; n?: number }[] = [
    { id: "resumo", rotulo: "Resumo" },
    { id: "pessoas", rotulo: "Pessoas", n: contatos.length || undefined },
    { id: "extras", rotulo: "Extras" },
    { id: "socios", rotulo: "Sócios", n: empresa?.socios.length || undefined },
  ];

  return (
    <div className="space-y-5">
      <header className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Descobrir</h1>
          <p className="sub-pagina">Veja a ficha completa de uma empresa e encontre quem decide nela.</p>
        </div>
        {saldo !== null && <p className="selo">Saldo: {saldo} créditos</p>}
      </header>

      <form onSubmit={buscarEmpresa} className="cartao flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="rotulo">CNPJ ou site da empresa</span>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00 ou empresa.com.br"
            className="input mt-1"
            inputMode="text"
            autoComplete="off"
          />
        </label>
        <button disabled={ocupado} className="btn-primario sm:min-w-40"><IconeBusca width={18} height={18} /> {ocupado && !empresa ? "Buscando…" : "Buscar empresa"}</button>
      </form>

      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
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

      {!empresa && !candidatos && !ocupado && (
        <div className="vazio">
          <Predio width={36} height={36} className="text-slate-400" />
          <p className="font-medium text-tinta">Digite um CNPJ ou o site de uma empresa</p>
          <p>Ou use <a className="text-marca-700 underline" href="/pesquisar">Pesquisar</a> para encontrar empresas por atividade, local e porte.</p>
        </div>
      )}

      {empresa && (
        <>
          <section className="cartao space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-marca-50 text-2xl font-semibold text-marca-700" aria-hidden>{nome.charAt(0)}</span>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight">{nome}</h2>
                  <p className="truncate text-sm text-slate-500">{empresa.razaoSocial} · {cnpjFmt}</p>
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
                  <Pessoa width={18} height={18} /> Buscar pessoas (1 crédito)
                </button>
                <p className="max-w-xs text-xs text-slate-500 lg:text-right">
                  {disponiveis !== null && disponiveis > 0 && !busca
                    ? `${disponiveis} contato${disponiveis > 1 ? "s" : ""} já coletado${disponiveis > 1 ? "s" : ""}, prontos sem nova varredura.`
                    : "Reúne sócios, site e fontes extras de uma vez; depois você refina sem gastar mais."}
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
                onClick={() => setAba(a.id)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition sm:gap-2 sm:px-4 ${aba === a.id ? "border-marca-700 text-marca-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {a.rotulo}
                {a.n !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a.n}</span>}
              </button>
            ))}
          </div>

          {aba === "resumo" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="kpi"><p className="kpi-rotulo">Abertura</p><p className="kpi-valor">{dataBr(empresa.abertaEm) ?? "—"}</p><p className="text-xs text-slate-500">{empresa.abertaEm ? idade(empresa.abertaEm) : ""}</p></div>
                <div className="kpi"><p className="kpi-rotulo">Capital social</p><p className="kpi-valor">{empresa.capitalSocial ? dinheiro(empresa.capitalSocial) : "—"}</p></div>
                <div className="kpi"><p className="kpi-rotulo">Funcionários</p><p className="kpi-valor">{extras.dados?.wikidata?.funcionarios ? extras.dados.wikidata.funcionarios.valor.toLocaleString("pt-BR") : "—"}</p><p className="text-xs text-slate-500">{extras.dados?.wikidata?.funcionarios?.ano ? `em ${extras.dados.wikidata.funcionarios.ano} (Wikidata)` : "sem fonte aberta"}</p></div>
                <div className="kpi"><p className="kpi-rotulo">Natureza jurídica</p><p className="text-sm font-medium leading-snug">{empresa.naturezaJuridica ?? "—"}</p></div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="cartao space-y-3 text-sm">
                  <h3 className="secao-titulo">Atividade</h3>
                  <p>{empresa.cnaePrincipal?.descricao ?? "—"}{empresa.cnaePrincipal?.codigo ? <span className="text-slate-400"> · CNAE {empresa.cnaePrincipal.codigo}</span> : null}</p>
                  {!!empresa.cnaesSecundarios?.length && (
                    <details>
                      <summary className="cursor-pointer text-marca-700">{empresa.cnaesSecundarios.length} atividades secundárias</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
                        {empresa.cnaesSecundarios.map((c) => <li key={c.codigo}>{c.descricao} <span className="text-slate-400">({c.codigo})</span></li>)}
                      </ul>
                    </details>
                  )}
                  {empresa.cnaePrincipal?.codigo && empresa.uf && (
                    <a className="btn-sec" href={`/pesquisar?segmento=${String(empresa.cnaePrincipal.codigo).slice(0, 5)}&uf=${empresa.uf}&cidade=${encodeURIComponent(empresa.municipio ?? "")}`}>
                      <IconeBusca width={16} height={16} /> Empresas do mesmo segmento em {empresa.municipio ?? empresa.uf}
                    </a>
                  )}
                </div>

                <div className="cartao space-y-3 text-sm">
                  <h3 className="secao-titulo">Contato e localização</h3>
                  <p className="flex gap-2"><Mapa width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" /><span>{enderecoTexto || "—"}
                    {(empresa.endereco?.logradouro || empresa.municipio) && (
                      <> <a className="text-marca-700 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([empresa.endereco?.logradouro, empresa.endereco?.numero, empresa.endereco?.bairro, empresa.municipio, empresa.uf].filter(Boolean).join(" "))}`}>ver no mapa</a></>
                    )}</span></p>
                  <p className="flex gap-2"><Telefone width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" />{empresa.telefones.length ? empresa.telefones.join(" · ") : "—"}</p>
                  <p className="flex gap-2 break-all"><Email width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" />{empresa.emailsCadastrais.length ? empresa.emailsCadastrais.join(" · ") : "—"}</p>
                  <p className="flex gap-2"><Externo width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" />{empresa.dominio ? <a className="text-marca-700 underline" target="_blank" rel="noopener noreferrer" href={`https://${empresa.dominio.replace(/^https?:\/\//, "")}`}>{empresa.dominio}</a> : "—"}</p>
                  <p className="text-xs text-slate-500">E-mails e telefones da Receita costumam ser da contabilidade; o contato do decisor vem de “Buscar pessoas”.</p>
                </div>
              </div>

              {sinais.length > 0 && (
                <div className="cartao space-y-2 text-sm">
                  <h3 className="secao-titulo">Sinais de compra</h3>
                  <ul className="space-y-1">{sinais.map((s) => <li key={s.id} className="flex items-center gap-2"><Relogio width={14} height={14} className="text-slate-400" />{s.tipo} · {s.fonte} · {new Date(s.ocorridoEm).toLocaleDateString("pt-BR")}</li>)}</ul>
                </div>
              )}
              <p className="text-xs text-slate-500">Fonte: {empresa.fonte}, em {new Date(empresa.obtidoEm).toLocaleString("pt-BR")}.</p>
            </div>
          )}

          {aba === "extras" && <Enriquecimento {...extras} />}

          {aba === "socios" && (
            <div className="cartao">
              {empresa.socios.length === 0 ? (
                <p className="text-sm text-slate-500">Sem quadro societário público para esta empresa (comum em MEI e empresas individuais).</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {empresa.socios.map((x, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca-50 font-semibold text-marca-700" aria-hidden>{x.nome.charAt(0)}</span>
                      <span><span className="font-medium">{x.nome}</span><span className="block text-xs text-slate-500">{x.qualificacao}{x.desde ? ` · desde ${dataBr(x.desde)}` : ""}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
        <section className="space-y-3">
          {contatos.some((c) => c.origem.includes("demonstração")) && <p className="aviso-erro border-amber-200 bg-amber-50 text-amber-800">Modo demonstração: os decisores abaixo são pessoas fictícias.</p>}
          <div className="cartao flex flex-wrap items-center gap-2 p-3 text-sm">
            <input value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} placeholder="Filtrar por nome ou cargo" className="input w-full sm:w-60" />
            <select value={filtro.depto} onChange={(e) => setFiltro({ ...filtro, depto: e.target.value })} className="input w-full sm:w-auto">
              <option value="">Todos os departamentos</option>
              {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select value={filtro.senior} onChange={(e) => setFiltro({ ...filtro, senior: e.target.value })} className="input w-full sm:w-auto">
              <option value="">Toda senioridade</option>
              {SENIORIDADES.map((d) => <option key={d}>{d}</option>)}
            </select>
            <label className="opcao"><input type="checkbox" checked={filtro.soEmail} onChange={(e) => setFiltro({ ...filtro, soEmail: e.target.checked })} />Com e-mail</label>
            <label className="opcao"><input type="checkbox" checked={filtro.soTel} onChange={(e) => setFiltro({ ...filtro, soTel: e.target.checked })} />Com telefone</label>
            <span className="ml-auto text-xs text-slate-500">{visiveis.length} de {contatos.length} pessoas</span>
          </div>

          <ul className="grid gap-3 lg:grid-cols-2">
            {visiveis.map((c) => (
              <li key={c.id} className="cartao space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca-50 text-lg font-semibold text-marca-700" aria-hidden>{c.nome.charAt(0)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.nome}</p>
                    <p className="truncate text-slate-600">{c.cargo}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-slate-500" title={`${c.origem} · ${new Date(c.obtidoEm).toLocaleDateString("pt-BR")}`}>
                    <span className="block font-medium text-slate-700">{Math.round(c.confianca * 100)}%</span>confiança
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden><div className="h-full rounded-full bg-marca-500" style={{ width: `${Math.round(c.confianca * 100)}%` }} /></div>
                <div className="space-y-1.5">
                  <p className="flex flex-wrap items-center gap-2">
                    <Email width={16} height={16} className="text-slate-400" />
                    {c.temEmail ? (
                      c.email ? (
                        <span className="break-all">{c.email} <em className="text-xs text-slate-500">({ROTULO_STATUS[c.emailStatus ?? "nao_verificado"]})</em></span>
                      ) : (
                        <button onClick={() => revelar(c.id, "email")} disabled={ocupado} className="btn-sec min-h-8 px-3 py-1">{c.emailMascarado} · revelar</button>
                      )
                    ) : <span className="text-slate-400">sem e-mail</span>}
                  </p>
                  <p className="flex flex-wrap items-center gap-2">
                    <Telefone width={16} height={16} className="text-slate-400" />
                    {c.temTelefone ? (
                      c.telefone ? <span>{c.telefone}</span> : <button onClick={() => revelar(c.id, "telefone")} disabled={ocupado} className="btn-sec min-h-8 px-3 py-1">{c.telefoneMascarado} · revelar</button>
                    ) : <span className="text-slate-400">sem telefone</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs">
                  <span className="text-slate-500">{c.origem}</span>
                  {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-marca-700 hover:underline">LinkedIn</a>}
                  {iaAtiva && <Abordagem contatoId={c.id} />}
                </div>
              </li>
            ))}
          </ul>

          <div className="cartao flex flex-col gap-2 sm:flex-row">
            <input value={listaNome} onChange={(e) => setListaNome(e.target.value)} placeholder="Nome da lista" className="input sm:w-72" />
            <button onClick={salvarEmLista} disabled={ocupado || !listaNome.trim()} className="btn-primario">Salvar todos em nova lista</button>
          </div>
        </section>
      )}
    </div>
  );
}
