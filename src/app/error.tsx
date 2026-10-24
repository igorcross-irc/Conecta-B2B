"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Tela de erro amigável. Registra o problema no painel da operadora (Plataforma > Saúde) e deixa tentar de novo. */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/erro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: error.message, digest: error.digest, caminho: window.location.pathname }),
    }).catch(() => {});
  }, [error]);
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="titulo-pagina">Algo deu errado</h1>
      <p className="sub-pagina">Não foi possível carregar esta tela. O problema foi registrado e a equipe responsável já consegue ver.</p>
      {error.digest && <p className="text-xs text-slate-400">Código: {error.digest}</p>}
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="btn-primario">Tentar de novo</button>
        <Link href="/" className="btn-sec">Ir para o início</Link>
      </div>
    </div>
  );
}
