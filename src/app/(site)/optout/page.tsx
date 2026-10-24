"use client";

import { useState } from "react";

export default function OptOut() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErro("");
    const r = await fetch("/api/optout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const dados = await r.json();
    if (!r.ok) setErro(dados.erro ?? "Erro inesperado.");
    else if (dados.confirmacaoPorEmail) {
      setMsg("Enviamos um link de confirmação para esse e-mail (vale por 2 horas). Abra o link para concluir; nada é apagado antes disso.");
    } else {
      setMsg("Pedido registrado. Seu e-mail e telefone foram apagados e você não aparecerá mais nas buscas.");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="titulo-pagina">Não quero ser contatado</h1>
      <p className="sub-pagina">
        Informe o e-mail profissional que aparece em nossas buscas. Vamos apagar seus dados de
        contato e impedir que voltem a ser listados.
      </p>
      <form onSubmit={enviar} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input flex-1"
          placeholder="voce@empresa.com.br"
        />
        <button className="btn-primario">
          Enviar
        </button>
      </form>
      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
      {msg && <p className="aviso-ok">{msg}</p>}
    </div>
  );
}
