"use client";

import { useState } from "react";

type Canal = "email" | "whatsapp" | "linkedin";

/** Rascunho de mensagem de primeira abordagem, gerado por IA para a pessoa revisar. Não usa e-mail nem telefone do contato. */
export function Abordagem({ contatoId }: { contatoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [canal, setCanal] = useState<Canal>("email");
  const [proposta, setProposta] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setErro("");
    setOcupado(true);
    setCopiado(false);
    try {
      const r = await fetch("/api/ia/abordagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contatoId, canal, proposta }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Erro inesperado.");
      setMensagem(dados.mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) {
    return <button onClick={() => setAberto(true)} className="text-marca-700 hover:underline">Escrever abordagem</button>;
  }
  return (
    <div className="mt-2 w-full space-y-2 rounded-md bg-slate-50 p-3">
      <div className="flex flex-wrap gap-2">
        <select value={canal} onChange={(e) => setCanal(e.target.value as Canal)} className="campo" aria-label="Canal">
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <input
          value={proposta}
          onChange={(e) => setProposta(e.target.value)}
          maxLength={600}
          placeholder="O que você oferece, em uma frase"
          className="campo min-w-0 flex-1"
        />
        <button onClick={gerar} disabled={ocupado || !proposta.trim()} className="btn">{ocupado ? "Escrevendo…" : "Gerar"}</button>
      </div>
      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
      {mensagem && (
        <>
          <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={8} className="campo w-full" aria-label="Mensagem" />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <button
              onClick={async () => { await navigator.clipboard.writeText(mensagem); setCopiado(true); }}
              className="text-marca-700 hover:underline"
            >
              {copiado ? "Copiado" : "Copiar"}
            </button>
            <span>Rascunho feito por IA: revise antes de enviar.</span>
          </div>
        </>
      )}
    </div>
  );
}
