"use client";

import { useActionState, useState } from "react";
import { criarConta, entrar, type EstadoForm } from "./actions";

const inicial: EstadoForm = {};

export default function Entrar() {
  const [novo, setNovo] = useState(false);
  const [estadoEntrar, acaoEntrar, ocupadoEntrar] = useActionState(entrar, inicial);
  const [estadoCriar, acaoCriar, ocupadoCriar] = useActionState(criarConta, inicial);
  const estado = novo ? estadoCriar : estadoEntrar;
  const ocupado = novo ? ocupadoCriar : ocupadoEntrar;

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-8">
      <h1 className="text-2xl font-semibold">{novo ? "Criar conta" : "Entrar"}</h1>
      <form action={novo ? acaoCriar : acaoEntrar} className="space-y-3">
        {novo && (
          <label className="block text-sm">
            Nome
            <input name="nome" required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
        )}
        <label className="block text-sm">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Senha
          <input
            name="senha"
            type="password"
            required
            minLength={novo ? 8 : undefined}
            autoComplete={novo ? "new-password" : "current-password"}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {estado.erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{estado.erro}</p>}
        <button
          disabled={ocupado}
          className="w-full rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          {novo ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <button onClick={() => setNovo(!novo)} className="text-sm text-indigo-700 hover:underline">
        {novo ? "Já tenho conta" : "Não tenho conta"}
      </button>
    </div>
  );
}
