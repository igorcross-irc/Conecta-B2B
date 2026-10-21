"use client";

import { useCallback, useEffect, useState } from "react";

interface ContatoLista {
  id: string;
  nome: string;
  cargo: string;
  email?: string;
  telefone?: string;
}
interface ListaComContatos {
  id: string;
  nome: string;
  contatos: ContatoLista[];
}

export default function Listas() {
  const [listas, setListas] = useState<ListaComContatos[]>([]);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const r = await fetch("/api/listas", { cache: "no-store" });
    setListas(await r.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const r = await fetch("/api/listas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!r.ok) setErro((await r.json()).erro);
    else {
      setNome("");
      await carregar();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Listas</h1>
      <form onSubmit={criar} className="flex gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da nova lista"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">
          Criar lista
        </button>
      </form>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {listas.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhuma lista ainda. Crie uma e adicione contatos pela tela Descobrir.
        </p>
      )}
      {listas.map((l) => (
        <section key={l.id} className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="font-medium">
              {l.nome} <span className="text-sm text-slate-500">({l.contatos.length})</span>
            </h2>
            <a
              href={`/api/listas/exportar?listaId=${l.id}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Exportar CSV
            </a>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {l.contatos.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  <strong>{c.nome}</strong> · {c.cargo}
                </span>
                <span className="text-slate-500">
                  {c.email ?? "e-mail oculto"} · {c.telefone ?? "telefone oculto"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-slate-500">
        O CSV leva só o que já foi revelado, para não vazar dado pago.
      </p>
    </div>
  );
}
