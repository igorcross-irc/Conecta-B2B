"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Barra fina no topo que aparece ao clicar num link interno e some quando a nova página chega. */
export function BarraProgresso() {
  const caminho = usePathname();
  const [ativa, setAtiva] = useState(0);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return;
      setAtiva((n) => n + 1);
      setVisivel(true);
    };
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setVisivel(false), 0);
    return () => clearTimeout(t);
  }, [caminho]);

  useEffect(() => {
    if (!visivel) return;
    const t = setTimeout(() => setVisivel(false), 15000);
    return () => clearTimeout(t);
  }, [visivel, ativa]);

  return visivel ? <div key={ativa} className="barra-progresso" aria-hidden /> : null;
}
