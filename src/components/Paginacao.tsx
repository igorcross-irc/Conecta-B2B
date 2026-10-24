import Link from "next/link";

/** Paginação numerada: primeira, última e duas páginas de cada lado da atual (páginas contadas a partir de 0). */
export function Paginacao({ pagina, paginas, href }: { pagina: number; paginas: number; href: (p: number) => string }) {
  if (paginas <= 1) return null;
  const janela = Array.from({ length: paginas }, (_, i) => i).filter((i) => i === 0 || i === paginas - 1 || Math.abs(i - pagina) <= 2);
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Páginas">
      {pagina > 0 && <Link className="chip" href={href(pagina - 1)}>← Anterior</Link>}
      {janela.map((i, idx) => (
        <span key={i} className="flex items-center gap-1.5">
          {idx > 0 && janela[idx - 1] !== i - 1 && <span className="text-slate-400">…</span>}
          <Link href={href(i)} aria-current={i === pagina ? "page" : undefined} className={i === pagina ? "chip-ativo" : "chip"}>{i + 1}</Link>
        </span>
      ))}
      {pagina + 1 < paginas && <Link className="chip" href={href(pagina + 1)}>Próxima →</Link>}
    </nav>
  );
}
