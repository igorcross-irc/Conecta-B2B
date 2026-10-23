"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemMenu {
  href: string;
  rotulo: string;
  secao?: string;
}

export function Menu({ itens }: { itens: ItemMenu[] }) {
  const atual = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-col gap-0.5">
      {itens.map((i, idx) => {
        const ativo = atual === i.href || atual.startsWith(i.href + "/");
        const cabecalho = i.secao && i.secao !== itens[idx - 1]?.secao ? i.secao : null;
        return (
          <div key={i.href}>
            {cabecalho && (
              <p className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-marca-200/70">
                {cabecalho}
              </p>
            )}
            <Link
              href={i.href}
              aria-current={ativo ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                ativo ? "bg-white/15 text-white" : "text-marca-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              {i.rotulo}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
