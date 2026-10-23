"use client";

import { useActionState } from "react";
import { renomearOrganizacao, type Resultado } from "../acoes";

export function FormNome({ nome }: { nome: string }) {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(renomearOrganizacao, {});
  return (
    <form action={acao} className="space-y-2">
      <div className="flex gap-3">
        <input name="nome" defaultValue={nome} required maxLength={80} className="input max-w-sm" aria-label="Nome da organização" />
        <button disabled={ocupado} className="btn-primario">Salvar</button>
      </div>
      {r.erro && <p role="alert" className="aviso-erro">{r.erro}</p>}
      {r.ok && <p className="aviso-ok">{r.ok}</p>}
    </form>
  );
}
