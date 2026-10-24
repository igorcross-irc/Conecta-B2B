"use client";

import { useEffect, useState } from "react";
import { Alerta, Check, Externo, Jornal, Predio, Pessoa } from "@/components/Icones";
import type { Enriquecimento as Dados } from "@/lib/enriquecimento/tipos";

const MOEDA = { USD: "US$", BRL: "R$", EUR: "€" } as const;
const abreviar = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi` : n >= 1e6 ? `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : n.toLocaleString("pt-BR");
const dataCurta = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "");

/** Carrega as fontes extras da empresa (CVM, Wikidata, notícias, sanções). Cada bloco aparece ou some sozinho. */
export function useEnriquecimento(cnpj: string | undefined) {
  const [estado, setEstado] = useState<{ cnpj: string; dados?: Dados; erro?: string } | null>(null);
  useEffect(() => {
    if (!cnpj) return;
    const ctl = new AbortController();
    fetch(`/api/empresa/enriquecimento?cnpj=${encodeURIComponent(cnpj)}`, { signal: ctl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro ?? "Erro inesperado.");
        setEstado({ cnpj, dados: j });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setEstado({ cnpj, erro: e instanceof Error ? e.message : "Erro inesperado." });
      });
    return () => ctl.abort();
  }, [cnpj]);
  // Enquanto o resultado é de outra empresa (ou não chegou), está carregando.
  return estado && estado.cnpj === cnpj ? { carregando: false, dados: estado.dados, erro: estado.erro } : { carregando: true, dados: undefined, erro: undefined };
}

function Bloco({ icone, titulo, fonte, children }: { icone: React.ReactNode; titulo: string; fonte: string; children: React.ReactNode }) {
  return (
    <section className="cartao space-y-3">
      <header className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-tinta"><span className="text-marca-700">{icone}</span>{titulo}</h3>
        <span className="selo-cinza shrink-0">{fonte}</span>
      </header>
      {children}
    </section>
  );
}

export function Enriquecimento({ carregando, dados, erro }: { carregando: boolean; dados?: Dados; erro?: string }) {
  if (carregando) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto h-36" />)}
      </div>
    );
  }
  if (erro || !dados) return <p role="alert" className="aviso-erro">{erro ?? "Não consegui carregar as informações extras."}</p>;
  const { cvm, wikidata, noticias, sancoes, erros } = dados;
  const semNada = !cvm && !wikidata;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco icone={<Predio width={18} height={18} />} titulo="Mercado de capitais" fonte="CVM">
        {cvm ? (
          <>
            <p className="text-sm"><span className="selo">Companhia aberta</span> <span className="ml-1 text-slate-600">{cvm.situacao === "ATIVO" ? "registro ativo" : cvm.situacao.toLowerCase()}</span></p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {cvm.setor && <div><dt className="text-slate-500">Setor</dt><dd>{cvm.setor}</dd></div>}
              {cvm.mercado && <div><dt className="text-slate-500">Mercado</dt><dd>{cvm.mercado[0] + cvm.mercado.slice(1).toLowerCase()}{cvm.categoria ? ` · ${cvm.categoria}` : ""}</dd></div>}
              {cvm.controleAcionario && <div><dt className="text-slate-500">Controle acionário</dt><dd>{cvm.controleAcionario[0] + cvm.controleAcionario.slice(1).toLowerCase()}</dd></div>}
              {cvm.auditor && <div><dt className="text-slate-500">Auditor</dt><dd>{cvm.auditor}</dd></div>}
            </dl>
            {cvm.responsavel && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium"><Pessoa width={16} height={16} />{cvm.responsavel.nome}</p>
                <p className="text-xs text-slate-500">{cvm.responsavel.cargo}</p>
                <p className="mt-1 break-all text-slate-700">{[...cvm.responsavel.emails, cvm.responsavel.telefone].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-xs text-slate-500">Contato institucional publicado pela empresa. Também aparece em “Buscar pessoas”.</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">{erros.cvm ? `Fonte indisponível agora (${erros.cvm}).` : "Não é companhia aberta registrada na CVM."}</p>
        )}
      </Bloco>

      <Bloco icone={<Check width={18} height={18} />} titulo="Porte e presença" fonte="Wikidata">
        {wikidata ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {wikidata.funcionarios && (
                <div><dt className="text-slate-500">Funcionários</dt><dd className="text-lg font-semibold">{wikidata.funcionarios.valor.toLocaleString("pt-BR")}<span className="ml-1 text-xs font-normal text-slate-500">{wikidata.funcionarios.ano ? `em ${wikidata.funcionarios.ano}` : ""}</span></dd></div>
              )}
              {wikidata.receita && (
                <div><dt className="text-slate-500">Receita</dt><dd className="text-lg font-semibold">{MOEDA[wikidata.receita.moeda]} {abreviar(wikidata.receita.valor)}<span className="ml-1 text-xs font-normal text-slate-500">{wikidata.receita.ano ? `em ${wikidata.receita.ano}` : ""}</span></dd></div>
              )}
              {wikidata.fundadaEm && <div><dt className="text-slate-500">Fundação</dt><dd>{wikidata.fundadaEm}</dd></div>}
            </dl>
            <p className="flex flex-wrap gap-3 text-sm">
              {wikidata.site && <a className="inline-flex items-center gap-1 text-marca-700 underline" target="_blank" rel="noopener noreferrer" href={wikidata.site}>Site <Externo width={14} height={14} /></a>}
              {wikidata.linkedin && <a className="inline-flex items-center gap-1 text-marca-700 underline" target="_blank" rel="noopener noreferrer" href={wikidata.linkedin}>LinkedIn da empresa <Externo width={14} height={14} /></a>}
              <a className="inline-flex items-center gap-1 text-slate-500 underline" target="_blank" rel="noopener noreferrer" href={wikidata.url}>Fonte <Externo width={14} height={14} /></a>
            </p>
            <p className="text-xs text-slate-500">Dados de enciclopédia aberta: podem estar desatualizados (veja o ano).</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">{erros.wikidata ? `Fonte indisponível agora (${erros.wikidata}).` : "Empresa sem verbete confirmado no Wikidata (só aceitamos quando o CNPJ ou o site conferem). Comum em empresas pequenas e médias."}</p>
        )}
      </Bloco>

      <Bloco icone={<Jornal width={18} height={18} />} titulo="Notícias dos últimos 30 dias" fonte="Google Notícias">
        {noticias && noticias.length > 0 ? (
          <>
            <ul className="space-y-2.5 text-sm">
              {noticias.map((n) => (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-marca-800 hover:underline">{n.titulo}</a>
                  <span className="block text-xs text-slate-500">{[n.fonte, dataCurta(n.publicadaEm)].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">Busca pelo nome: pode incluir empresas homônimas.</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">{erros.noticias ? `Fonte indisponível agora (${erros.noticias}).` : "Nenhuma notícia encontrada no período."}</p>
        )}
      </Bloco>

      <Bloco icone={<Alerta width={18} height={18} />} titulo="Sanções do governo federal" fonte="CEIS e CNEP">
        {sancoes === undefined ? (
          <p className="text-sm text-slate-500">{erros.sancoes ? `Fonte indisponível agora (${erros.sancoes}).` : "Consulta desligada. O operador precisa cadastrar a chave gratuita do Portal da Transparência (PORTAL_TRANSPARENCIA_TOKEN)."}</p>
        ) : sancoes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-800"><Check width={16} height={16} /> Nenhuma sanção encontrada nos cadastros CEIS e CNEP.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sancoes.map((s, i) => (
              <li key={i} className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="font-medium text-red-900">{s.cadastro}{s.tipo ? ` · ${s.tipo}` : ""}</p>
                <p className="text-xs text-red-800">{[s.orgao, s.inicio && `desde ${s.inicio}`, s.fim && `até ${s.fim}`, s.multa && `multa R$ ${s.multa}`].filter(Boolean).join(" · ")}</p>
                {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs underline">Publicação</a>}
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      {semNada && !erros.cvm && !erros.wikidata && (
        <p className="text-sm text-slate-500 lg:col-span-2">Para empresas pequenas, as fontes abertas trazem pouco além do cadastro da Receita. Use “Buscar pessoas” para achar contatos.</p>
      )}
    </div>
  );
}
