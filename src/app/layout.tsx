import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Conecta-B2B — decisores e contatos de empresas brasileiras", template: "%s · Conecta-B2B" },
  description:
    "Encontre quem decide dentro de qualquer empresa brasileira a partir do CNPJ. Base colaborativa que cresce a cada busca, com fontes abertas e LGPD no centro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <Suspense fallback={<p className="p-8 text-sm text-slate-500">Carregando…</p>}>{children}</Suspense>
      </body>
    </html>
  );
}
