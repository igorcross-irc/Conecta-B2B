"use client";

import { useState } from "react";

export default function OptOut() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErro("");
    const r = await fetch("/api/optout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const dados = await r.json();
    if (!r.ok) setErro(dados.erro ?? "Erro inesperado.");
    else setMsg("Pedido registrado. Seu e-mail e telefone foram apagados e você não aparecerá mais nas buscas.");
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Não quero ser contatado</h1>
      <p className="text-sm text-slate-600">
        Informe o e-mail profissional que aparece em nossas buscas. Vamos apagar seus dados de
        contato e impedir que voltem a ser listados.
      </p>
      <form onSubmit={enviar} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="voce@empresa.com.br"
        />
        <button className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">
          Enviar
        </button>
      </form>
      {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {msg && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
    </div>
  );
}
