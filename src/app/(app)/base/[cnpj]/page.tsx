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
  const nome = e.nomeFantasia || e.razaoSocial;
  return (
    <div className="space-y-5">
      <Link href="/base" className="inline-flex items-center gap-1 text-sm text-marca-700 hover:underline">← Base comum</Link>

      <section className="cartao flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-marca-50 text-2xl font-semibold text-marca-700" aria-hidden>{nome.charAt(0)}</span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{nome}</h1>
            <p className="truncate text-sm text-slate-500">{e.razaoSocial} · {formatarCnpj(e.cnpj)}{e.municipio && ` · ${e.municipio}/${e.uf}`}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {e.situacao && <span className="selo">{e.situacao}</span>}
              {e.porte && <span className="selo-cinza">{e.porte}</span>}
              {f.tags.map((t) => <span key={t} className="selo-cinza">#{t}</span>)}
            </div>
          </div>
        </div>
        <Link href={`/empresa/${e.cnpj}?de=${encodeURIComponent("/base")}`} className="btn-destaque shrink-0">Ver ficha e decisores</Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cartao space-y-2 text-sm">
          <h2 className="secao-titulo">Dados públicos</h2>
          {e.cnaePrincipal && <p><span className="text-slate-500">Atividade:</span> {e.cnaePrincipal.descricao}</p>}
          {e.dominio && <p><span className="text-slate-500">Site:</span> {e.dominio}</p>}
          <p className="text-xs text-slate-500">Fonte: Receita Federal via APIs abertas.</p>
        </section>

        <section className="cartao space-y-3 text-sm">
          <h2 className="secao-titulo">Decisores já encontrados</h2>
          {f.cargosDisponiveis.length === 0 ? (
            <p className="text-slate-600">Ninguém ainda. A primeira busca desta empresa alimenta a base.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {f.cargosDisponiveis.map((c) => <li key={c.cargo} className="selo">{c.cargo} ({c.quantidade})</li>)}
            </ul>
          )}
          <p className="text-xs text-slate-500">Nomes e contatos aparecem ao buscar; e-mail e telefone exigem crédito para revelar.</p>
        </section>
      </div>

      {f.nota && (
        <section className="cartao-destaque text-sm">
          <h2 className="secao-titulo mb-1">Nota da comunidade</h2>
          <p>{f.nota}</p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cartao space-y-3">
          <h2 className="font-semibold">Corrigir informações</h2>
          <p className="text-xs text-slate-500">Vale para todos os usuários e fica registrado na auditoria. Informar o site certo melhora as próximas buscas.</p>
          <FormEmpresa cnpj={e.cnpj} dominio={e.dominio ?? ""} nota={f.nota ?? ""} tags={f.tags.join(", ")} />
        </section>
        <section className="cartao space-y-3">
          <h2 className="font-semibold">Adicionar contato à base</h2>
          <p className="text-xs text-slate-500">Só informe dados profissionais que você pode compartilhar. Quem pedir opt-out é excluído.</p>
          <FormContato cnpj={e.cnpj} />
        </section>
      </div>
    </div>
  );
}
