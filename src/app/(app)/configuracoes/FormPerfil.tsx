"use client";

import { useActionState } from "react";
import type { PerfilIdeal } from "@/lib/aderencia";
import { PORTES, SETORES } from "@/lib/setores";
import { UFS } from "@/lib/ufs";
import { salvarPerfilIdealAcao, type Resultado } from "../acoes";

export function FormPerfil({ perfil }: { perfil: PerfilIdeal }) {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(salvarPerfilIdealAcao, {});
  return (
    <form action={acao} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="rotulo">Setores</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {SETORES.map((s) => (
            <label key={s.id} className="opcao"><input type="checkbox" name="setor" value={s.id} defaultChecked={perfil.setores.includes(s.id)} />{s.nome}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="rotulo">Porte</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {PORTES.map((p) => (
            <label key={p} className="opcao"><input type="checkbox" name="porte" value={p} defaultChecked={perfil.portes.includes(p)} />{p}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="rotulo">Estados</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {UFS.map(([sigla]) => (
            <label key={sigla} className="opcao"><input type="checkbox" name="uf" value={sigla} defaultChecked={perfil.ufs.includes(sigla)} />{sigla}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-3">
          <span className="rotulo">Cidades (separadas por vírgula; vazio = qualquer)</span>
          <input name="cidades" defaultValue={perfil.cidades.join(", ")} maxLength={300} className="input mt-1" />
        </label>
        <label className="block text-sm">
          <span className="rotulo">Idade mínima (anos)</span>
          <input name="idadeMin" type="number" min={0} max={200} defaultValue={perfil.idadeMin ?? ""} className="input mt-1" />
        </label>
        <label className="block text-sm">
          <span className="rotulo">Idade máxima (anos)</span>
          <input name="idadeMax" type="number" min={0} max={200} defaultValue={perfil.idadeMax ?? ""} className="input mt-1" />
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="opcao"><input type="checkbox" name="exigeEmail" value="1" defaultChecked={perfil.exigeEmail} />Precisa ter e-mail cadastral</label>
        <label className="opcao"><input type="checkbox" name="exigeTelefone" value="1" defaultChecked={perfil.exigeTelefone} />Precisa ter telefone cadastral</label>
      </div>
      <button disabled={ocupado} className="btn-primario">Salvar perfil</button>
      {r.erro && <p role="alert" className="aviso-erro">{r.erro}</p>}
      {r.ok && <p className="aviso-ok">{r.ok}</p>}
    </form>
  );
}
