"use client";
import { useState, useTransition } from "react";
import { testarIA } from "../../acoes";
import type { ResultadoIA } from "@/lib/ia/gemini";

export function FormTesteIA() {
  const [prompt, setPrompt] = useState("Responda em uma frase: o que é um CNPJ e para que serve em prospecção B2B?");
  const [r, setR] = useState<ResultadoIA | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="cartao space-y-3">
      <textarea className="campo w-full" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button className="btn" disabled={pendente || !prompt.trim()} onClick={() => iniciar(async () => setR(await testarIA(prompt)))}>
        {pendente ? "Testando…" : "Testar Gemini"}
      </button>
      {r && (
        <div className={`rounded-lg border p-3 text-sm ${r.ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          <p className="font-medium">{r.ok ? "Funcionando" : "Falhou"}{r.modelo ? ` · ${r.modelo}` : ""}{r.ms ? ` · ${r.ms} ms` : ""}</p>
          {r.resposta && <p className="mt-2 whitespace-pre-wrap">{r.resposta}</p>}
          {r.erro && <p className="mt-2 break-words">{r.erro}</p>}
          {r.modelosFlash && <p className="mt-2 text-xs text-slate-500">Modelos flash disponíveis: {r.modelosFlash.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}
