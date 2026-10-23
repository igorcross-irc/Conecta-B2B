import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="Conecta-B2B, página inicial"><Logo /></Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/privacidade" className="text-slate-600 hover:text-tinta">Privacidade</Link>
            <Link href="/entrar" className="text-slate-600 hover:text-tinta">Entrar</Link>
            <Link href="/entrar?novo=1" className="btn-primario">Criar conta grátis</Link>
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
