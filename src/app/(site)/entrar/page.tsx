"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { criarConta, entrar, type EstadoForm } from "./actions";

const inicial: EstadoForm = {};

function Formulario() {
  const sp = useSearchParams();
  const proximo = sp.get("proximo") ?? "";
  const [novo, setNovo] = useState(sp.get("novo") === "1");
  const [estadoEntrar, acaoEntrar, ocupadoEntrar] = useActionState(entrar, inicial);
  const [estadoCriar, acaoCriar, ocupadoCriar] = useActionState(criarConta, inicial);
  const estado = novo ? estadoCriar : estadoEntrar;
  const ocupado = novo ? ocupadoCriar : ocupadoEntrar;

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-4">
      <h1 className="titulo-pagina">{novo ? "Criar conta" : "Entrar"}</h1>
      {novo && <p className="sub-pagina">Você recebe créditos de teste para começar. Sem cartão.</p>}
      <form action={novo ? acaoCriar : acaoEntrar} className="cartao space-y-3">
        <input type="hidden" name="proximo" value={proximo} />
        {novo && (
          <label className="block">
            <span className="rotulo">Nome</span>
            <input name="nome" required className="input mt-1" />
          </label>
        )}
        <label className="block">
          <span className="rotulo">E-mail</span>
          <input name="email" type="email" required autoComplete="email" className="input mt-1" />
        </label>
        <label className="block">
          <span className="rotulo">Senha</span>
          <input
            name="senha"
            type="password"
            required
            minLength={novo ? 8 : undefined}
            autoComplete={novo ? "new-password" : "current-password"}
            className="input mt-1"
          />
        </label>
        {estado.erro && <p role="alert" className="aviso-erro">{estado.erro}</p>}
        <button disabled={ocupado} className="btn-primario w-full">{novo ? "Criar conta" : "Entrar"}</button>
      </form>
      <button onClick={() => setNovo(!novo)} className="text-sm text-marca-700 hover:underline">
        {novo ? "Já tenho conta" : "Não tenho conta"}
      </button>
    </div>
  );
}

export default function Entrar() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
