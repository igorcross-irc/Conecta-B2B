import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="Conecta-B2B, página inicial" className="shrink-0 whitespace-nowrap"><Logo /></Link>
          <nav className="flex items-center gap-3 whitespace-nowrap text-sm sm:gap-4">
            <Link href="/privacidade" className="hidden text-slate-600 hover:text-tinta sm:inline">Privacidade</Link>
            <Link href="/entrar" className="text-slate-600 hover:text-tinta">Entrar</Link>
            <Link href="/entrar?novo=1" className="btn-primario"><span className="sm:hidden">Criar conta</span><span className="hidden sm:inline">Criar conta grátis</span></Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        © Conecta-B2B · Dados de fontes abertas · <Link href="/privacidade" className="underline">Privacidade e LGPD</Link> ·{" "}
        <Link href="/optout" className="underline">Opt-out</Link>
      </footer>
    </div>
  );
}
