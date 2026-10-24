"use client";

import { formatarNome, pareceEmpresa } from "@/lib/pessoas";
import { dataBr, type Empresa } from "./tipos";

/** Aba "Sócios": quadro societário público da Receita, com sócios que são empresas marcados. */
export function AbaSocios({ empresa, nome }: { empresa: Empresa; nome: string }) {
  return (
  <div className="cartao">
    {empresa.socios.length === 0 ? (
      <p className="text-sm text-slate-500">Sem quadro societário público para esta empresa (comum em MEI e empresas individuais).</p>
    ) : (
      <>
      <p className="mb-3 text-xs text-slate-500">Quadro societário público da Receita Federal de <b>{nome}</b>. Sócios que são pessoas e têm cargo de decisão também aparecem em “Pessoas” depois da busca.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {empresa.socios.map((x, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca-50 font-semibold text-marca-700" aria-hidden>{x.nome.charAt(0)}</span>
            <span className="min-w-0">
              <span className="block break-words font-medium">{formatarNome(x.nome)}</span>
              <span className="block text-xs text-slate-500">{x.qualificacao}{x.desde ? ` · desde ${dataBr(x.desde)}` : ""}</span>
              {(x.pessoaJuridica || pareceEmpresa(x.nome)) && <span className="mt-0.5 inline-block rounded bg-slate-200 px-1.5 text-[11px] font-medium text-slate-700">Empresa sócia (não é uma pessoa)</span>}
            </span>
          </li>
        ))}
      </ul>
      </>
    )}
  </div>
  );
}
