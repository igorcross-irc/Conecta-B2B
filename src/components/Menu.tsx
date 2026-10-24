"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ICONES, type NomeIcone } from "./Icones";

export interface ItemMenu {
  href: string;
  rotulo: string;
  icone: NomeIcone;
  secao?: string;
}

/**
 * Menu lateral. Celular (gaveta) e computador largo: ícone + texto. Tablet: só ícones (trilho), com o nome no `title`.
 */
export function Menu({ itens }: { itens: ItemMenu[] }) {
  const atual = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-col gap-0.5">
      {itens.map((i, idx) => {
        const ativo = atual === i.href || atual.startsWith(i.href + "/");
        const cabecalho = i.secao && i.secao !== itens[idx - 1]?.secao ? i.secao : null;
        const Icone = ICONES[i.icone];
        return (
          <div key={i.href}>
            {cabecalho && (
              <>
                <p className="mt-5 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-marca-200/70 md:hidden xl:block">{cabecalho}</p>
                <hr className="my-3 hidden border-white/10 md:block xl:hidden" />
              </>
            )}
            <Link
              href={i.href}
              title={i.rotulo}
              aria-label={i.rotulo}
              aria-current={ativo ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition md:justify-center xl:justify-start ${
                ativo ? "bg-white/15 text-white shadow-inner" : "text-marca-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              {ativo && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-destaque" aria-hidden />}
              <Icone className="shrink-0" />
              <span className="md:hidden xl:inline">{i.rotulo}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
