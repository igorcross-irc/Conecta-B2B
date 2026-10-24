"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "@/components/Icones";
import { paraParametros } from "@/lib/filtrosUrl";

export function BuscaNatural() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function entender(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      const r = await fetch("/api/ia/interpretar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Erro inesperado.");
      const qs = paraParametros(dados.filtros);
      if (!qs) throw new Error("Não consegui transformar isso em filtros. Tente citar atividade, local ou porte.");
      router.push(`/pesquisar?${qs}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={entender} className="cartao-destaque space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-marca-800" htmlFor="busca-natural">
        <Sparkles width={18} height={18} /> Pergunte em português
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="busca-natural"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={400}
          placeholder="Padarias abertas há menos de 3 anos em Niterói, com telefone"
          className="input flex-1"
        />
        <button className="btn-primario" disabled={ocupado || !texto.trim()}>{ocupado ? "Entendendo…" : "Buscar com IA"}</button>
      </div>
      <p className="text-xs text-slate-500">A IA só preenche os filtros ao lado; você confere e ajusta antes de ver os resultados.</p>
      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
    </form>
  );
}
