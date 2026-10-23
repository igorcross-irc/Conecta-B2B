"use client";

import { useActionState } from "react";
import { atualizarEmpresa, contribuirContato, type Resultado } from "../../acoes";

function Msg({ r }: { r: Resultado }) {
  return (
    <>
      {r.erro && <p role="alert" className="aviso-erro">{r.erro}</p>}
      {r.ok && <p className="aviso-ok">{r.ok}</p>}
    </>
  );
}

export function FormEmpresa(p: { cnpj: string; dominio: string; nota: string; tags: string }) {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(atualizarEmpresa, {});
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="cnpj" value={p.cnpj} />
      <label className="block">
        <span className="rotulo">Site da empresa</span>
        <input name="dominio" defaultValue={p.dominio} className="input mt-1" placeholder="empresa.com.br" />
      </label>
      <label className="block">
        <span className="rotulo">Nota</span>
        <textarea name="nota" defaultValue={p.nota} maxLength={500} rows={2} className="input mt-1" />
      </label>
      <label className="block">
        <span className="rotulo">Tags (separadas por vírgula)</span>
        <input name="tags" defaultValue={p.tags} className="input mt-1" placeholder="indústria, grupo-x" />
      </label>
      <Msg r={r} />
      <button disabled={ocupado} className="btn-primario">Salvar para todos</button>
    </form>
  );
}

export function FormContato({ cnpj }: { cnpj: string }) {
  const [r, acao, ocupado] = useActionState<Resultado, FormData>(contribuirContato, {});
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="cnpj" value={cnpj} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="rotulo">Nome</span><input name="nome" required className="input mt-1" /></label>
        <label><span className="rotulo">Cargo</span><input name="cargo" required className="input mt-1" /></label>
        <label><span className="rotulo">E-mail</span><input name="email" type="email" className="input mt-1" /></label>
        <label><span className="rotulo">Telefone</span><input name="telefone" className="input mt-1" /></label>
      </div>
      <label className="block">
        <span className="rotulo">LinkedIn (endereço público)</span>
        <input name="linkedin" className="input mt-1" placeholder="https://www.linkedin.com/in/..." />
      </label>
      <Msg r={r} />
      <button disabled={ocupado} className="btn-primario">Adicionar à base</button>
    </form>
  );
}
