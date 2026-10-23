"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * No computador: coluna fixa à esquerda. No celular: barra no topo com botão de menu (gaveta)
 * e barra de atalhos embaixo, para a tela útil ficar com o conteúdo.
 */
export function PainelLateral({
  children,
  logo,
  saldo,
  atalhos,
}: {
  children: ReactNode;
  logo: ReactNode;
  saldo: number;
  atalhos: { href: string; rotulo: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const atual = usePathname();

  // Fecha a gaveta ao trocar de página.
  useEffect(() => {
    const t = setTimeout(() => setAberto(false), 0);
    return () => clearTimeout(t);
  }, [atual]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-marca-900 px-4 py-2 text-white md:hidden">
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="-ml-2 rounded-lg p-2 text-2xl leading-none hover:bg-white/10"
        >
          ☰
        </button>
        <Link href="/descobrir" aria-label="Conecta-B2B">{logo}</Link>
        <Link href="/creditos" className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
          {saldo} créd.
        </Link>
      </header>

      {aberto && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setAberto(false)} aria-hidden />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-marca-900 p-4 text-white transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:max-w-none md:shrink-0 md:translate-x-0 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
          className="self-end rounded-lg px-2 py-1 text-xl leading-none hover:bg-white/10 md:hidden"
        >
          ✕
        </button>
        {children}
      </aside>

      <nav
        aria-label="Atalhos"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${atalhos.length}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {atalhos.map((a) => {
          const ativo = atual === a.href || atual.startsWith(a.href + "/");
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`py-3 text-center text-xs font-medium ${ativo ? "text-marca-700" : "text-slate-500"}`}
            >
              {a.rotulo}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
