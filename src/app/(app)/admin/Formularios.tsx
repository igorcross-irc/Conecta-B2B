"use client";

import { useActionState } from "react";
import { recarregar, salvarCustos, type Resultado } from "../acoes";

function Msg({ r }: { r: Resultado }) {
  return (
    <>
      {r.erro && <p role="alert" className="aviso-erro">{r.erro}</p>}
      {r.ok && <p className="aviso-ok">{r.ok}</p>}
    </>
  );
}

export function FormRecarga({ org }: { org: string }) {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(recarregar, {});
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="org" value={org} />
      <p className="rotulo">Recarregar créditos</p>
      <div className="flex gap-2">
        <input name="valor" type="number" min={1} required className="input w-24" aria-label="Valor" />
        <input name="descricao" className="input" placeholder="Motivo" aria-label="Motivo" />
        <button disabled={ocupado} className="btn-primario">Adicionar</button>
      </div>
      <Msg r={r} />
    </form>
  );
}

export function FormCustos({ org, custos }: { org: string; custos: Record<string, number> }) {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(salvarCustos, {});
  const campos: [string, string][] = [
    ["busca_decisores", "Busca"],
    ["revelar_email", "E-mail"],
    ["revelar_telefone", "Telefone"],
  ];
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="org" value={org} />
      <p className="rotulo">Custos por operação</p>
      <div className="flex items-end gap-2">
        {campos.map(([k, rot]) => (
          <label key={k} className="text-xs text-slate-600">
            {rot}
            <input name={k} type="number" min={1} defaultValue={custos[k]} required className="input mt-0.5 w-20" />
          </label>
        ))}
        <button disabled={ocupado} className="btn-sec">Salvar</button>
      </div>
      <Msg r={r} />
    </form>
  );
}
