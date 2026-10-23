"use client";

import { useEffect, useState } from "react";

const DICAS = [
  "Dica: pesquise pelo site da empresa para achar e-mails e telefones públicos sem precisar do CNPJ.",
  "Dica: filtre por setor e cidade para montar uma lista de prospecção em poucos cliques.",
  "Dica: contatos revelados ficam na sua organização e não são cobrados de novo.",
  "Dica: só cobramos créditos quando a busca entrega resultado.",
  "Dica: a base comum melhora a cada pesquisa de qualquer pessoa da plataforma.",
];

/** Três pontinhos animados e uma dica que muda a cada poucos segundos. */
export function Carregando({ texto = "Carregando" }: { texto?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % DICAS.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-500">
      <p className="font-medium text-marca-700">
        {texto}
        <span className="ml-2" aria-hidden>
          <span className="pontinho" />
          <span className="pontinho" />
          <span className="pontinho" />
        </span>
      </p>
      <p className="max-w-md">{DICAS[i]}</p>
    </div>
  );
}
