"use client";

import { useState } from "react";

interface Resultado {
  importados: number;
  ignorados: number;
  erros: string[];
}

export default function Importar() {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [compartilhar, setCompartilhar] = useState(false);

  async function enviar() {
    setErro("");
    setResultado(null);
    setOcupado(true);
    try {
      const r = await fetch(`/api/importar${compartilhar ? "?compartilhar=1" : ""}`, { method: "POST", body: texto, cache: "no-store" });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Erro inesperado.");
      setResultado(dados as Resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Importar contatos</h1>
      <p className="text-sm text-slate-600">
        Traga contatos que você já tem. Colunas obrigatórias: <code>cnpj</code>, <code>nome</code>,{" "}
        <code>cargo</code>. Opcionais: <code>email</code>, <code>telefone</code>,{" "}
        <code>linkedin</code>. A importação não gasta créditos, e quem pediu opt-out é ignorado.
        Importe apenas dados que você tem base legal para usar.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setTexto(await f.text());
        }}
        className="block text-sm"
      />
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        placeholder={"cnpj,nome,cargo,email,telefone\n33000167000101,Maria Silva,Diretora Comercial,maria@empresa.com.br,"}
        className="w-full rounded-md border border-slate-300 p-3 font-mono text-xs"
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={compartilhar} onChange={(e) => setCompartilhar(e.target.checked)} className="mt-1" />
        <span>
          Compartilhar com a base comum: os contatos passam a aparecer nas buscas de todos os usuários (mediante crédito
          para revelar). Marque só se você pode compartilhar esses dados.
        </span>
      </label>
      <button
        onClick={enviar}
        disabled={ocupado || !texto.trim()}
        className="rounded-md bg-marca-700 px-4 py-2 text-sm font-medium text-white hover:bg-marca-900 disabled:opacity-50"
      >
        Importar
      </button>
      {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {resultado && (
        <div className="space-y-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
          <p>
            {resultado.importados} importados, {resultado.ignorados} ignorados por opt-out,{" "}
            {resultado.erros.length} com erro.
          </p>
          {resultado.erros.length > 0 && (
            <ul className="list-disc pl-5 text-red-700">
              {resultado.erros.map((x) => <li key={x}>{x}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
