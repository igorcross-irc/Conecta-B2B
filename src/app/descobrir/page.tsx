"use client";

import { useEffect, useState } from "react";

interface Empresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  porte?: string;
  municipio?: string;
  uf?: string;
  cnaePrincipal?: { descricao: string };
  dominio?: string;
  fonte: string;
  obtidoEm: string;
}

interface Contato {
  id: string;
  nome: string;
  cargo: string;
  departamento?: string;
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

export default function Descobrir() {
  const [cnpj, setCnpj] = useState("");
  const [cargos, setCargos] = useState("comercial, marketing");
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
    if ((b.contatos ?? []).length === 0) setAviso("Nenhum decisor encontrado. A busca foi estornada.");
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

  const buscarEmpresa = (e: React.FormEvent) => {
    e.preventDefault();
    setContatos([]);
    setBusca(null);
    setDisponiveis(null);
    void executar(async () => {
      const q = encodeURIComponent(cnpj);
      setEmpresa(await chamar<Empresa>(`/api/empresa?cnpj=${q}`));
      setSinais(await chamar<Sinal[]>(`/api/sinais?cnpj=${q}`));
      setDisponiveis((await chamar<{ disponiveis: number }>(`/api/decisores/disponiveis?cnpj=${q}`)).disponiveis);
      // Retoma uma busca recente (em andamento ou concluída) desta empresa.
      aplicarBusca(await chamar<Busca | null>(`/api/decisores/busca?cnpj=${q}`));
    });
  };

  const buscarDecisores = () =>
    executar(async () => {
      setContatos([]);
      aplicarBusca(
        await chamar<Busca>("/api/decisores/busca", {
          cnpj,
          cargos: cargos.split(",").map((c) => c.trim()).filter(Boolean),
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
          CNPJ da empresa
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="mt-1 block w-60 rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          disabled={ocupado}
          className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          Buscar empresa
        </button>
      </form>

      {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {aviso && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}

      {empresa && (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-medium">{empresa.nomeFantasia ?? empresa.razaoSocial}</h2>
            <p className="text-sm text-slate-500">{empresa.razaoSocial}</p>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-500">Situação</dt><dd>{empresa.situacao}</dd></div>
            <div><dt className="text-slate-500">Porte</dt><dd>{empresa.porte ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Local</dt><dd>{empresa.municipio ?? "—"}{empresa.uf ? `/${empresa.uf}` : ""}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">Atividade</dt><dd>{empresa.cnaePrincipal?.descricao ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Domínio</dt><dd>{empresa.dominio ?? "—"}</dd></div>
          </dl>
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
          <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            <label className="text-sm">
              Cargos ou áreas (separe por vírgula)
              <input
                value={cargos}
                onChange={(e) => setCargos(e.target.value)}
                className="mt-1 block w-72 rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <button
              onClick={buscarDecisores}
              disabled={ocupado || emAndamento}
              className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              Buscar decisores (1 crédito)
            </button>
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
              className={`rounded-md p-3 text-sm ${busca.status === "erro" ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-900"}`}
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
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {contatos.map((c) => (
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
                      <button onClick={() => revelar(c.id, "email")} disabled={ocupado} className="text-indigo-700 hover:underline disabled:opacity-50">
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
                      <button onClick={() => revelar(c.id, "telefone")} disabled={ocupado} className="text-indigo-700 hover:underline disabled:opacity-50">
                        {c.telefoneMascarado} · revelar telefone
                      </button>
                    )
                  ) : (
                    <span className="text-slate-400">sem telefone</span>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">
                      LinkedIn
                    </a>
                  )}
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
              className="rounded-md border border-indigo-700 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              Salvar todos em nova lista
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
