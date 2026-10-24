"use client";

import { useState } from "react";

/** O apagamento só acontece no clique (um POST), para que leitores automáticos de e-mail que abrem o link não o consumam. */
export function ConfirmarOptOut({ token }: { token: string }) {
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setErro("");
    const r = await fetch("/api/optout/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const dados = await r.json();
    setEnviando(false);
    if (!r.ok) setErro(dados.erro ?? "Erro inesperado.");
    else setMsg("Pronto. Seu e-mail e telefone foram apagados e você não aparecerá mais nas buscas.");
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="titulo-pagina">Confirmar pedido</h1>
      <p className="sub-pagina">
        Confirme para apagar seus dados de contato e impedir que voltem a ser listados.
      </p>
      {!msg && (
        <button className="btn-primario" onClick={confirmar} disabled={enviando || !token}>
          {enviando ? "Confirmando…" : "Confirmar e apagar meus dados"}
        </button>
      )}
      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
      {msg && <p className="aviso-ok">{msg}</p>}
    </div>
  );
}
