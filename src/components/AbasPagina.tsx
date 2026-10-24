"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Abas de navegação entre subpáginas de uma mesma área (ex.: Plataforma). Rolam de lado no celular. */
export function AbasPagina({ abas, rotulo }: { abas: { href: string; rotulo: string }[]; rotulo: string }) {
  const atual = usePathname();
  return (
    <nav aria-label={rotulo} className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 md:mx-0 md:px-0">
      {abas.map((a) => {
        const ativa = a.href === abas[0].href ? atual === a.href : atual === a.href || atual.startsWith(a.href + "/");
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${ativa ? "border-marca-700 text-marca-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
