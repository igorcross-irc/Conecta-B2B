"use client";

import { Busca as IconeBusca, Email, Externo, Mapa, Pessoa, Predio, Relogio, Telefone } from "@/components/Icones";
import type { Enriquecimento as Dados } from "@/lib/enriquecimento/tipos";
import { cepBr, dataBr, dinheiro, idade, type Empresa, type Sinal } from "./tipos";

/** Aba "Resumo" da empresa: números-chave, atividade, endereço e contato cadastrados na Receita e sinais de compra. */
export function AbaResumo({ empresa, extras, sinais }: { empresa: Empresa; extras: { dados?: Dados }; sinais: Sinal[] }) {
  const enderecoTexto = empresa
    ? [empresa.endereco?.logradouro && `${empresa.endereco.logradouro}${empresa.endereco.numero ? `, ${empresa.endereco.numero}` : ""}`, empresa.endereco?.complemento, empresa.endereco?.bairro, empresa.municipio && `${empresa.municipio}${empresa.uf ? `/${empresa.uf}` : ""}`, empresa.endereco?.cep && `CEP ${cepBr(empresa.endereco.cep)}`].filter(Boolean).join(" · ")
    : "";
  return (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="kpi"><p className="kpi-rotulo">Abertura</p><p className="kpi-valor">{dataBr(empresa.abertaEm) ?? "—"}</p><p className="text-xs text-slate-500">{empresa.abertaEm ? idade(empresa.abertaEm) : ""}</p></div>
      <div className="kpi"><p className="kpi-rotulo">Capital social</p><p className="kpi-valor">{empresa.capitalSocial ? dinheiro(empresa.capitalSocial) : "—"}</p></div>
      <div className="kpi"><p className="kpi-rotulo">Funcionários</p><p className="kpi-valor">{extras.dados?.wikidata?.funcionarios ? extras.dados.wikidata.funcionarios.valor.toLocaleString("pt-BR") : "—"}</p><p className="text-xs text-slate-500">{extras.dados?.wikidata?.funcionarios?.ano ? `em ${extras.dados.wikidata.funcionarios.ano} (Wikidata)` : "sem fonte aberta"}</p></div>
      <div className="kpi"><p className="kpi-rotulo">Natureza jurídica</p><p className="text-sm font-medium leading-snug">{empresa.naturezaJuridica ?? "—"}</p></div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="cartao space-y-3 text-sm">
        <h3 className="secao-titulo">Atividade</h3>
        <p>{empresa.cnaePrincipal?.descricao ?? "—"}{empresa.cnaePrincipal?.codigo ? <span className="text-slate-400"> · CNAE {empresa.cnaePrincipal.codigo}</span> : null}</p>
        {!!empresa.cnaesSecundarios?.length && (
          <details>
            <summary className="cursor-pointer text-marca-700">{empresa.cnaesSecundarios.length} atividades secundárias</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
              {empresa.cnaesSecundarios.map((c) => <li key={c.codigo}>{c.descricao} <span className="text-slate-400">({c.codigo})</span></li>)}
            </ul>
          </details>
        )}
        <a className="btn-sec" href={`/parecidas?cnpj=${empresa.cnpj}`}>
          <Predio width={16} height={16} /> Empresas parecidas com esta
        </a>
        {!empresa.cnpj.startsWith("site:") && (
          <a className="btn-sec" href={`/base/${empresa.cnpj}`}>
            <Pessoa width={16} height={16} /> Notas da comunidade e correções
          </a>
        )}
        {empresa.cnaePrincipal?.codigo && empresa.uf && (
          <a className="btn-sec" href={`/pesquisar?segmento=${String(empresa.cnaePrincipal.codigo).slice(0, 5)}&uf=${empresa.uf}&cidade=${encodeURIComponent(empresa.municipio ?? "")}`}>
            <IconeBusca width={16} height={16} /> Empresas do mesmo segmento em {empresa.municipio ?? empresa.uf}
          </a>
        )}
      </div>

      <div className="cartao space-y-3 text-sm">
        <h3 className="secao-titulo">Endereço e contato cadastrados na Receita</h3>
        <p className="flex gap-2"><Mapa width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" /><span>{enderecoTexto || "—"}
          {(empresa.endereco?.logradouro || empresa.municipio) && (
            <> <a className="text-marca-700 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([empresa.endereco?.logradouro, empresa.endereco?.numero, empresa.endereco?.bairro, empresa.municipio, empresa.uf].filter(Boolean).join(" "))}`}>ver no mapa</a></>
          )}</span></p>
        <p className="flex gap-2"><Telefone width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" />{empresa.telefones.length ? empresa.telefones.join(" · ") : "—"}</p>
        <p className="flex gap-2 break-all"><Email width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" />{empresa.emailsCadastrais.length ? empresa.emailsCadastrais.join(" · ") : "—"}</p>
        <p className="flex gap-2"><Externo width={18} height={18} className="mt-0.5 shrink-0 text-slate-400" />{empresa.dominio ? <a className="text-marca-700 underline" target="_blank" rel="noopener noreferrer" href={`https://${empresa.dominio.replace(/^https?:\/\//, "")}`}>{empresa.dominio}</a> : "—"}</p>
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Estes são os dados da <b>empresa</b> no cadastro público e costumam ser da contabilidade, não de um decisor. Para falar com quem decide, use “Buscar pessoas”.</p>
      </div>
    </div>

    {sinais.length > 0 && (
      <div className="cartao space-y-2 text-sm">
        <h3 className="secao-titulo">Sinais de compra</h3>
        <ul className="space-y-1">{sinais.map((s) => <li key={s.id} className="flex items-center gap-2"><Relogio width={14} height={14} className="text-slate-400" />{s.tipo} · {s.fonte} · {new Date(s.ocorridoEm).toLocaleDateString("pt-BR")}</li>)}</ul>
      </div>
    )}
    <p className="text-xs text-slate-500">Fonte: {empresa.fonte}, em {new Date(empresa.obtidoEm).toLocaleString("pt-BR")}.</p>
  </div>
  );
}
