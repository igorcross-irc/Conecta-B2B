"use client";

import { Email, Telefone } from "@/components/Icones";
import { DEPARTAMENTOS, SENIORIDADES, classificarCargo } from "@/lib/cargos";
import { descreverOrigem, nivelDeConfianca } from "@/lib/origem";
import { formatarNome } from "@/lib/pessoas";
import { Abordagem } from "./Abordagem";
import { COR_ORIGEM, ROTULO_STATUS, STATUS_CURTO, creditos, type Contato } from "./tipos";

export interface FiltroPessoas { depto: string; senior: string; soEmail: boolean; soTel: boolean; texto: string }
export const FILTRO_VAZIO: FiltroPessoas = { depto: "", senior: "", soEmail: false, soTel: false, texto: "" };

interface Props {
  nome: string;
  cnpjFmt: string | undefined;
  contatos: Contato[];
  visiveis: Contato[];
  filtro: FiltroPessoas;
  setFiltro: (f: FiltroPessoas) => void;
  custos: { busca: number; email: number; telefone: number };
  iaAtiva: boolean;
  ocupado: boolean;
  revelar: (contatoId: string, campo: "email" | "telefone") => void;
  listaNome: string;
  setListaNome: (v: string) => void;
  salvarEmLista: () => void;
}

/** Pessoas colhidas da empresa: cabeçalho de quem são, filtros, cartões com origem e confiança, revelar e salvar em lista. */
export function ListaPessoas({ nome, cnpjFmt, contatos, visiveis, filtro, setFiltro, custos, iaAtiva, ocupado, revelar, listaNome, setListaNome, salvarEmLista }: Props) {
  return (
  <section className="space-y-3" aria-label={`Pessoas de ${nome}`}>
    <div className="cartao-destaque flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-3">
      <p className="text-sm"><span className="text-slate-600">Pessoas ligadas a</span> <b className="text-marca-800">{nome}</b> <span className="text-slate-500">· {cnpjFmt}</span></p>
      <p className="text-xs text-slate-500">Cada pessoa mostra de onde veio e se o dado é confirmado ou palpite.</p>
    </div>
    {contatos.some((c) => c.origem.includes("demonstração")) && <p className="aviso-erro border-amber-200 bg-amber-50 text-amber-800">Modo demonstração: os decisores abaixo são pessoas fictícias.</p>}
    <details open={contatos.length > 5} className="cartao p-0 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium text-marca-800 marker:hidden">
        <span>Filtrar pessoas</span>
        <span className="text-xs font-normal text-slate-500">{visiveis.length} de {contatos.length} pessoas</span>
      </summary>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
      <input value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} placeholder="Filtrar por nome ou cargo" aria-label="Filtrar por nome ou cargo" className="input w-full sm:w-60" />
      <select value={filtro.depto} onChange={(e) => setFiltro({ ...filtro, depto: e.target.value })} aria-label="Departamento" className="input w-full sm:w-auto">
        <option value="">Todos os departamentos</option>
        {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
      </select>
      <select value={filtro.senior} onChange={(e) => setFiltro({ ...filtro, senior: e.target.value })} aria-label="Senioridade" className="input w-full sm:w-auto">
        <option value="">Toda senioridade</option>
        {SENIORIDADES.map((d) => <option key={d}>{d}</option>)}
      </select>
      <label className="opcao"><input type="checkbox" checked={filtro.soEmail} onChange={(e) => setFiltro({ ...filtro, soEmail: e.target.checked })} />Com e-mail</label>
      <label className="opcao"><input type="checkbox" checked={filtro.soTel} onChange={(e) => setFiltro({ ...filtro, soTel: e.target.checked })} />Com telefone</label>
      </div>
    </details>

    {visiveis.length === 0 && (
      <div className="vazio">
        <p className="font-medium text-tinta">Nenhuma pessoa com esses filtros</p>
        <button type="button" className="btn-sec" onClick={() => setFiltro({ depto: "", senior: "", soEmail: false, soTel: false, texto: "" })}>Limpar filtros</button>
      </div>
    )}

    <ul className="grid gap-3 lg:grid-cols-2">
      {visiveis.map((c) => {
        const etiquetas = descreverOrigem(c.origem);
        const conf = nivelDeConfianca(c.confianca, etiquetas);
        const k = classificarCargo(c.cargo);
        return (
          <li key={c.id} className="cartao space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca-50 text-lg font-semibold text-marca-700" aria-hidden>{c.nome.charAt(0)}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{formatarNome(c.nome)}</p>
                <p className="break-words text-slate-600">{c.cargo}</p>
                <p className="text-xs text-slate-500">{k.senioridade !== "Outros" ? k.senioridade : "Cargo sem nível definido"} · {k.departamento}</p>
              </div>
            </div>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs marker:hidden">
                <span className={`rounded-full px-2 py-0.5 font-medium ${conf.nivel === "alta" ? "bg-emerald-100 text-emerald-800" : conf.nivel === "media" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`}>{conf.rotulo}</span>
                <span className="text-slate-500 underline decoration-dotted">por quê?</span>
              </summary>
              <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                <p>{conf.razao} <span className="text-slate-400">({Math.round(c.confianca * 100)}%)</span></p>
                <ul className="space-y-1">{etiquetas.map((e) => <li key={e.rotulo}><b>{e.rotulo}:</b> {e.explicacao}</li>)}</ul>
                <p className="text-slate-400">Obtido em {new Date(c.obtidoEm).toLocaleDateString("pt-BR")}.</p>
              </div>
            </details>
            <div className="space-y-1.5">
              <p className="flex items-start gap-2">
                <Email width={16} height={16} className="mt-1.5 shrink-0 text-slate-400" />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {c.temEmail ? (
                  c.email ? (
                    <span className="break-all">{c.email}{" "}
                      <em className={`text-xs not-italic ${c.emailStatus === "inferido" ? "rounded bg-amber-100 px-1.5 py-0.5 text-amber-900" : "text-slate-500"}`}>{ROTULO_STATUS[c.emailStatus ?? "nao_verificado"]}</em>
                    </span>
                  ) : (
                    <>
                      <button onClick={() => revelar(c.id, "email")} disabled={ocupado} className="btn-sec min-h-8 whitespace-nowrap px-3 py-1">Revelar e-mail · {creditos(custos.email)}</button>
                      <span className="text-xs text-slate-500">{c.emailMascarado}</span>
                      <em className={`text-xs not-italic ${c.emailStatus === "inferido" ? "rounded bg-amber-100 px-1.5 py-0.5 text-amber-900" : "text-slate-500"}`}>{STATUS_CURTO[c.emailStatus ?? "nao_verificado"]}</em>
                    </>
                  )
                ) : <span className="text-slate-400">sem e-mail</span>}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Telefone width={16} height={16} className="mt-1.5 shrink-0 text-slate-400" />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {c.temTelefone ? (
                  c.telefone ? <span>{c.telefone}</span> : (
                    <>
                      <button onClick={() => revelar(c.id, "telefone")} disabled={ocupado} className="btn-sec min-h-8 whitespace-nowrap px-3 py-1">Revelar telefone · {creditos(custos.telefone)}</button>
                      <span className="text-xs text-slate-500">{c.telefoneMascarado}</span>
                    </>
                  )
                ) : <span className="text-slate-400">sem telefone</span>}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-400">Fonte:</span>
              {etiquetas.map((e) => <span key={e.rotulo} title={e.explicacao} className={`rounded-full px-2 py-0.5 ${COR_ORIGEM[e.tom]}`}>{e.rotulo}</span>)}
              {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-marca-700 hover:underline">LinkedIn</a>}
              {iaAtiva && <Abordagem contatoId={c.id} />}
            </div>
          </li>
        );
      })}
    </ul>

    <div className="cartao flex flex-col gap-2 sm:flex-row sm:items-center">
      <input value={listaNome} onChange={(e) => setListaNome(e.target.value)} placeholder="Nome da nova lista" aria-label="Nome da nova lista" className="input sm:w-72" />
      <button onClick={salvarEmLista} disabled={ocupado || !listaNome.trim() || visiveis.length === 0} className="btn-primario">
        {visiveis.length === contatos.length ? `Salvar as ${contatos.length} pessoas em nova lista` : `Salvar as ${visiveis.length} pessoas filtradas em nova lista`}
      </button>
    </div>
  </section>
  );
}
