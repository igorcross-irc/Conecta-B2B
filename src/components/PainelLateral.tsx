"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Fechar, ICONES, Menu as IconeMenu, type NomeIcone } from "./Icones";

/**
 * Três desenhos para a mesma navegação:
 * - celular (<768px): barra no topo, gaveta lateral e barra de atalhos embaixo;
 * - tablet (768–1279px): trilho estreito só com ícones, para o conteúdo ficar com a largura;
 * - computador (1280px+): coluna completa com textos.
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
  atalhos: { href: string; rotulo: string; icone: NomeIcone }[];
}) {
  const [aberto, setAberto] = useState(false);
  const atual = usePathname();

  // Fecha a gaveta ao trocar de página e com a tecla Esc.
  useEffect(() => {
    const t = setTimeout(() => setAberto(false), 0);
    return () => clearTimeout(t);
  }, [atual]);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-marca-900 px-4 py-2 text-white shadow-md md:hidden">
        <button onClick={() => setAberto(true)} aria-label="Abrir menu" aria-expanded={aberto} className="-ml-2 rounded-lg p-2 hover:bg-white/10">
          <IconeMenu width={24} height={24} />
        </button>
        <Link href="/pesquisar" aria-label="Conecta-B2B">{logo}</Link>
        <Link href="/creditos" className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
          {saldo} créd.
        </Link>
      </header>

      {aberto && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden" onClick={() => setAberto(false)} aria-hidden />}

      <aside
        aria-label="Navegação"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-marca-900 p-4 text-white shadow-2xl transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:w-[84px] md:max-w-none md:shrink-0 md:translate-x-0 md:px-3 md:shadow-none xl:w-64 xl:px-4 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="self-end rounded-lg p-2 hover:bg-white/10 md:hidden">
          <Fechar width={22} height={22} />
        </button>
        {children}
      </aside>

      <nav
        aria-label="Atalhos"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${atalhos.length + 1}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {atalhos.map((a) => {
          const ativo = atual === a.href || atual.startsWith(a.href + "/");
          const Icone = ICONES[a.icone];
          return (
            <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${ativo ? "text-marca-700" : "text-slate-500"}`}>
              <Icone width={22} height={22} />
              {a.rotulo}
            </Link>
          );
        })}
        <button onClick={() => setAberto(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <IconeMenu width={22} height={22} />
          Mais
        </button>
      </nav>
    </>
  );
}
