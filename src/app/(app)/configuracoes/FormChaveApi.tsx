"use client";

import { useActionState } from "react";
import { criarChaveApiAcao, type Resultado } from "../acoes";

export function FormChaveApi() {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(criarChaveApiAcao, {});
  return (
    <form action={acao} className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <input name="nome" required maxLength={80} placeholder="Nome da chave (ex.: CRM)" className="input max-w-sm" aria-label="Nome da chave" />
        <button disabled={ocupado} className="btn-primario">Criar chave</button>
      </div>
      {r.erro && <p role="alert" className="aviso-erro">{r.erro}</p>}
      {r.ok && <p className="aviso-ok">{r.ok}</p>}
      {r.chave && <code className="block break-all rounded bg-slate-100 p-2 text-xs select-all">{r.chave}</code>}
    </form>
  );
}
