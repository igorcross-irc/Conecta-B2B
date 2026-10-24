"use client";

import { Abordagem } from "./Abordagem";
import { useEffect, useState } from "react";
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

  // Guarda o estado da busca e, ao concluir, mostra os contatos.
  function aplicarBusca(b: Busca | null) {
    setBusca(b);
    if (b?.status !== "concluida") return;
    setContatos(b.contatos ?? []);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Descobrir</h1>
        {saldo !== null && <p className="text-sm text-slate-600">Saldo: {saldo} créditos</p>}
      </div>

      <form onSubmit={buscarEmpresa} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          CNPJ ou site da empresa
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00 ou empresa.com.br"
            className="mt-1 block w-80 max-w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          disabled={ocupado}
          className="rounded-md bg-marca-700 px-4 py-2 text-sm font-medium text-white hover:bg-marca-900 disabled:opacity-50"
        >
          Buscar empresa
        </button>
      </form>

      {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {aviso && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}

      {candidatos && (
        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p className="font-medium">Encontrei mais de um CNPJ em {siteBuscado}. Qual é a empresa?</p>
          <ul className="space-y-2">
            {candidatos.map((c) => (
              <li key={c.cnpj} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{c.nomeFantasia ?? c.razaoSocial}</b>
                  <span className="text-slate-500"> · {c.cnpj}{c.municipio && ` · ${c.municipio}/${c.uf}`}</span>
                </span>
                <button type="button" disabled={ocupado} onClick={() => void executar(() => carregar(c.cnpj, siteBuscado))} className="rounded-md border border-marca-700 px-3 py-1 text-marca-700 hover:bg-marca-50 disabled:opacity-50">
                  Esta
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {empresa && (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-medium">{empresa.nomeFantasia ?? empresa.razaoSocial}</h2>
            <p className="text-sm text-slate-500">{empresa.razaoSocial}</p>
            {empresa.cnpj.startsWith("site:") && (
              <p className="mt-1 text-sm text-slate-600">
                Pesquisando só pelo site, sem CNPJ.{" "}
                <button type="button" disabled={ocupado} onClick={acharCnpj} className="text-marca-700 underline">Procurar o CNPJ deste site</button>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-marca-50 px-2 py-1 text-marca-900">{empresa.situacao}</span>
            {empresa.matriz !== undefined && <span className="rounded-full bg-slate-100 px-2 py-1">{empresa.matriz ? "Matriz" : "Filial"}</span>}
            {empresa.porte && <span className="rounded-full bg-slate-100 px-2 py-1">{empresa.porte}</span>}
            {empresa.mei && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">MEI</span>}
            {empresa.simples && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">Simples Nacional</span>}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">CNPJ</dt><dd>{empresa.cnpj.startsWith("site:") ? "—" : empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</dd></div>
            <div><dt className="text-slate-500">Abertura</dt><dd>{dataBr(empresa.abertaEm) ?? "—"}{empresa.abertaEm ? ` · ${idade(empresa.abertaEm)}` : ""}</dd></div>
            <div><dt className="text-slate-500">Natureza jurídica</dt><dd>{empresa.naturezaJuridica ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Capital social</dt><dd>{empresa.capitalSocial ? dinheiro(empresa.capitalSocial) : "—"}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Atividade principal</dt>
              <dd>
                {empresa.cnaePrincipal?.descricao ?? "—"}
                {empresa.cnaePrincipal?.codigo ? <span className="text-slate-400"> · CNAE {empresa.cnaePrincipal.codigo}</span> : null}
              </dd>
            </div>
            {!!empresa.cnaesSecundarios?.length && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Atividades secundárias ({empresa.cnaesSecundarios.length})</dt>
                <dd>
                  <details>
                    <summary className="cursor-pointer text-marca-700">Ver todas</summary>
                    <ul className="mt-1 list-disc pl-5 text-slate-600">
                      {empresa.cnaesSecundarios.map((c) => <li key={c.codigo}>{c.descricao} <span className="text-slate-400">({c.codigo})</span></li>)}
                    </ul>
                  </details>
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Endereço</dt>
              <dd>
                {[empresa.endereco?.logradouro && `${empresa.endereco.logradouro}${empresa.endereco.numero ? `, ${empresa.endereco.numero}` : ""}`, empresa.endereco?.complemento, empresa.endereco?.bairro, empresa.municipio && `${empresa.municipio}${empresa.uf ? `/${empresa.uf}` : ""}`, empresa.endereco?.cep && `CEP ${cepBr(empresa.endereco.cep)}`].filter(Boolean).join(" · ") || "—"}
                {(empresa.endereco?.logradouro || empresa.municipio) && (
                  <>
                    {" "}
                    <a
                      className="text-marca-700 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([empresa.endereco?.logradouro, empresa.endereco?.numero, empresa.endereco?.bairro, empresa.municipio, empresa.uf].filter(Boolean).join(" "))}`}
                    >
                      ver no mapa
                    </a>
                  </>
                )}
              </dd>
            </div>
            <div><dt className="text-slate-500">Telefones cadastrais</dt><dd>{empresa.telefones.length ? empresa.telefones.join(" · ") : "—"}</dd></div>
            <div><dt className="text-slate-500">E-mails cadastrais</dt><dd className="break-all">{empresa.emailsCadastrais.length ? empresa.emailsCadastrais.join(" · ") : "—"}</dd></div>
            <div>
              <dt className="text-slate-500">Site</dt>
              <dd>
                {empresa.dominio ? (
                  <a className="text-marca-700 underline" target="_blank" rel="noopener noreferrer" href={`https://${empresa.dominio.replace(/^https?:\/\//, "")}`}>{empresa.dominio}</a>
                ) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Faturamento e funcionários</dt>
              <dd className="text-slate-400">Em breve (não existe fonte gratuita confiável)</dd>
            </div>
          </dl>
          {empresa.socios.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 text-slate-500">Quadro societário ({empresa.socios.length})</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {empresa.socios.map((x, i) => (
                  <li key={i} className="rounded-md bg-slate-50 px-3 py-2">
                    <span className="font-medium">{x.nome}</span>
                    <span className="block text-xs text-slate-500">{x.qualificacao}{x.desde ? ` · desde ${dataBr(x.desde)}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {empresa.cnaePrincipal?.codigo && empresa.uf && (
            <p className="text-sm">
              <a
                className="text-marca-700 underline"
                href={`/pesquisar?segmento=${String(empresa.cnaePrincipal.codigo).slice(0, 5)}&uf=${empresa.uf}&cidade=${encodeURIComponent(empresa.municipio ?? "")}`}
              >
                Ver empresas do mesmo segmento em {empresa.municipio ?? empresa.uf}
              </a>
            </p>
          )}
          {sinais.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 text-slate-500">Sinais de compra</p>
              <ul className="space-y-1">
                {sinais.map((s) => (
                  <li key={s.id}>
                    {s.tipo} · {s.fonte} · {new Date(s.ocorridoEm).toLocaleDateString("pt-BR")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Fonte: {empresa.fonte}, em {new Date(empresa.obtidoEm).toLocaleString("pt-BR")}.
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <button
              onClick={buscarDecisores}
              disabled={ocupado || emAndamento}
              className="rounded-md bg-marca-700 px-4 py-2 text-sm font-medium text-white hover:bg-marca-900 disabled:opacity-50"
            >
              Buscar pessoas (1 crédito)
            </button>
            <p className="max-w-xl text-xs text-slate-500">
              Busca em todas as fontes de uma vez (sócios da Receita, site da empresa e as fontes extras ligadas) e
              reúne tudo; depois você refina por departamento e senioridade, sem gastar mais.
            </p>
          </div>
          {disponiveis !== null && disponiveis > 0 && !busca && (
            <p className="text-sm text-slate-600">
              {disponiveis} contato{disponiveis > 1 ? "s" : ""} desta empresa já foram coletados e estão prontos
              para trazer, sem nova varredura.
            </p>
          )}
          {busca && busca.status !== "concluida" && (
            <div
              role="status"
              className={`rounded-md p-3 text-sm ${busca.status === "erro" ? "bg-red-50 text-red-700" : "bg-marca-50 text-marca-900"}`}
            >
              {busca.status === "em_andamento" ? (
                <>
                  <p className="font-medium">{busca.etapa}…</p>
                  <p className="text-xs">
                    Isso costuma levar alguns segundos. Pode sair desta tela: a busca continua e, ao voltar e
                    buscar a empresa de novo, o resultado aparece.
                  </p>
                </>
              ) : (
                <p>{busca.erro ?? "A busca falhou."} O crédito foi devolvido.</p>
              )}
            </div>
          )}
          {busca?.status === "concluida" && busca.doPool && (
            <p className="text-xs text-slate-500">Resultado reaproveitado de uma varredura recente.</p>
          )}
        </section>
      )}

      {contatos.length > 0 && (
        <section className="space-y-3">
          {contatos.some((c) => c.origem.includes("demonstração")) && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Modo demonstração: os decisores abaixo são pessoas fictícias.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <input
              value={filtro.texto}
              onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
              placeholder="Filtrar por nome ou cargo"
              className="w-56 rounded-md border border-slate-300 px-2 py-1"
            />
            <select value={filtro.depto} onChange={(e) => setFiltro({ ...filtro, depto: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1">
              <option value="">Todos os departamentos</option>
              {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select value={filtro.senior} onChange={(e) => setFiltro({ ...filtro, senior: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1">
              <option value="">Toda senioridade</option>
              {SENIORIDADES.map((d) => <option key={d}>{d}</option>)}
            </select>
            <label className="flex items-center gap-1"><input type="checkbox" checked={filtro.soEmail} onChange={(e) => setFiltro({ ...filtro, soEmail: e.target.checked })} />com e-mail</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={filtro.soTel} onChange={(e) => setFiltro({ ...filtro, soTel: e.target.checked })} />com telefone</label>
            <span className="ml-auto text-xs text-slate-500">{visiveis.length} de {contatos.length} pessoas</span>
          </div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {visiveis.map((c) => (
              <li key={c.id} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    <strong>{c.nome}</strong> · {c.cargo}
                  </span>
                  <span className="text-xs text-slate-500">
                    {c.origem} · {new Date(c.obtidoEm).toLocaleDateString("pt-BR")} · confiança{" "}
                    {Math.round(c.confianca * 100)}%
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {c.temEmail ? (
                    c.email ? (
                      <span>
                        {c.email}{" "}
                        <em className="text-xs text-slate-500">
                          ({ROTULO_STATUS[c.emailStatus ?? "nao_verificado"]})
                        </em>
                      </span>
                    ) : (
                      <button onClick={() => revelar(c.id, "email")} disabled={ocupado} className="text-marca-700 hover:underline disabled:opacity-50">
                        {c.emailMascarado} · revelar e-mail
                      </button>
                    )
                  ) : (
                    <span className="text-slate-400">sem e-mail</span>
                  )}
                  {c.temTelefone ? (
                    c.telefone ? (
                      <span>{c.telefone}</span>
                    ) : (
                      <button onClick={() => revelar(c.id, "telefone")} disabled={ocupado} className="text-marca-700 hover:underline disabled:opacity-50">
                        {c.telefoneMascarado} · revelar telefone
                      </button>
                    )
                  ) : (
                    <span className="text-slate-400">sem telefone</span>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-marca-700 hover:underline">
                      LinkedIn
                    </a>
                  )}
                  {iaAtiva && <Abordagem contatoId={c.id} />}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <input
              value={listaNome}
              onChange={(e) => setListaNome(e.target.value)}
              placeholder="Nome da lista"
              className="w-60 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={salvarEmLista}
              disabled={ocupado || !listaNome.trim()}
              className="rounded-md border border-marca-700 px-4 py-2 text-sm font-medium text-marca-700 hover:bg-marca-50 disabled:opacity-50"
            >
              Salvar todos em nova lista
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
