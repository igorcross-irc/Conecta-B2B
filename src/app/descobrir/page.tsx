"use client";

import { useState } from "react";

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
    void executar(async () => {
      setEmpresa(await chamar<Empresa>(`/api/empresa?cnpj=${encodeURIComponent(cnpj)}`));
    });
  };

  const buscarDecisores = () =>
    executar(async () => {
      const r = await chamar<{ contatos: Contato[]; saldo: number }>("/api/decisores", {
        cnpj,
        cargos: cargos.split(",").map((c) => c.trim()).filter(Boolean),
        chave: crypto.randomUUID(),
      });
      setContatos(r.contatos);
      setSaldo(r.saldo);
      if (r.contatos.length === 0) setAviso("Nenhum decisor encontrado. A busca foi estornada.");
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
              disabled={ocupado}
              className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              Buscar decisores (1 crédito)
            </button>
          </div>
        </section>
      )}

      {contatos.length > 0 && (
        <section className="space-y-3">
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Modo demonstração: os decisores abaixo são pessoas fictícias. Os provedores reais
            entram quando houver chaves de API.
          </p>
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
