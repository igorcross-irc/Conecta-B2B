import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { formatarCnpj } from "@/lib/cnpj";
import { ErroDeNegocio } from "@/lib/servicos";
import { FormEmpresa, FormContato } from "./Formularios";

export default async function Ficha({ params }: PageProps<"/base/[cnpj]">) {
  await connection();
  const { cnpj } = await params;
  const { servicos } = await contexto();
  let f;
  try {
    f = await servicos.fichaBase(cnpj);
  } catch (e) {
    if (e instanceof ErroDeNegocio) {
      if (e.status === 404 || e.status === 400) notFound();
      return <p className="aviso-erro">{e.message}</p>;
    }
    throw e;
  }
  const { empresa: e } = f;
  return (
    <div className="space-y-6">
      <Link href="/base" className="text-sm text-marca-700 underline">← Base comum</Link>
      <header>
        <h1 className="titulo-pagina">{e.nomeFantasia || e.razaoSocial}</h1>
        <p className="sub-pagina">
          {e.razaoSocial} · {formatarCnpj(e.cnpj)}
          {e.municipio && ` · ${e.municipio}/${e.uf}`}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="cartao space-y-2 text-sm">
          <h2 className="font-medium">Dados públicos</h2>
          {e.cnaePrincipal && <p>Atividade: {e.cnaePrincipal.descricao}</p>}
          {e.porte && <p>Porte: {e.porte}</p>}
          {e.situacao && <p>Situação cadastral: {e.situacao}</p>}
          {e.dominio && <p>Site: {e.dominio}</p>}
          <p className="text-xs text-slate-500">Fonte: Receita Federal via APIs abertas.</p>
        </section>

        <section className="cartao space-y-2 text-sm">
          <h2 className="font-medium">Decisores já encontrados</h2>
          {f.cargosDisponiveis.length === 0 ? (
            <p className="text-slate-600">Ninguém ainda. A primeira busca desta empresa alimenta a base.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {f.cargosDisponiveis.map((c) => (
                <li key={c.cargo} className="selo">{c.cargo} ({c.quantidade})</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            Nomes e contatos aparecem ao buscar; e-mail e telefone exigem crédito para revelar.
          </p>
          <Link href={`/descobrir?cnpj=${e.cnpj}`} className="btn-primario mt-2">Buscar decisores</Link>
        </section>
      </div>

      {f.nota && (
        <section className="cartao text-sm">
          <h2 className="mb-1 font-medium">Nota da comunidade</h2>
          <p>{f.nota}</p>
          {f.tags.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">{f.tags.map((t) => <span key={t} className="selo-cinza">#{t}</span>)}</p>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="cartao space-y-3">
          <h2 className="font-medium">Corrigir informações</h2>
          <p className="text-xs text-slate-500">
            Vale para todos os usuários e fica registrado na auditoria. Informar o site certo melhora as próximas buscas.
          </p>
          <FormEmpresa cnpj={e.cnpj} dominio={e.dominio ?? ""} nota={f.nota ?? ""} tags={f.tags.join(", ")} />
        </section>
        <section className="cartao space-y-3">
          <h2 className="font-medium">Adicionar contato à base</h2>
          <p className="text-xs text-slate-500">
            Só informe dados profissionais que você pode compartilhar. Quem pedir opt-out é excluído.
          </p>
          <FormContato cnpj={e.cnpj} />
        </section>
      </div>
    </div>
  );
}
