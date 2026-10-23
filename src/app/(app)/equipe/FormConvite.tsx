"use client";

import { useActionState } from "react";
import { convidar, type Resultado } from "../acoes";

export function FormConvite() {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(convidar, {});
  return (
    <form action={acao} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="min-w-64 flex-1">
          <span className="rotulo">E-mail</span>
          <input name="email" type="email" required className="input mt-1" placeholder="pessoa@empresa.com.br" />
        </label>
        <label>
          <span className="rotulo">Papel</span>
          <select name="papel" className="input mt-1">
            <option value="membro">Membro</option>
            <option value="administrador">Administrador</option>
          </select>
        </label>
        <button disabled={ocupado} className="btn-primario self-end">Criar convite</button>
      </div>
      {r.erro && <p role="alert" className="aviso-erro">{r.erro}</p>}
      {r.ok && (
        <div className="aviso-ok space-y-2">
          <p>{r.ok}</p>
          {r.link && (
            <input readOnly value={r.link} onFocus={(e) => e.currentTarget.select()} className="input font-mono text-xs" />
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">
        O link é secreto: quem o tiver entra na organização com o papel escolhido. Não há envio de e-mail automático.
      </p>
    </form>
  );
}
