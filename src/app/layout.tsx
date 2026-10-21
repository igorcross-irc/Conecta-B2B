import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conecta-B2B",
  description: "Prospecção B2B: empresas, decisores e contatos verificados.",
};

const MENU = [
  { href: "/descobrir", rotulo: "Descobrir" },
  { href: "/listas", rotulo: "Listas" },
  { href: "/creditos", rotulo: "Créditos" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
          <nav className="flex gap-1 border-b border-slate-200 bg-white p-3 md:w-48 md:flex-col md:border-b-0 md:border-r md:p-4">
            <span className="px-3 py-2 text-lg font-semibold text-indigo-700">
              Conecta-B2B
            </span>
            {MENU.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {m.rotulo}
              </Link>
            ))}
          </nav>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
