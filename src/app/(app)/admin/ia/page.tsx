import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { contexto } from "@/lib/app";
import { chaveGemini } from "@/lib/ia/gemini";
import { FormTesteIA } from "./FormTesteIA";

export const metadata = { title: "Teste de IA" };

export default async function TesteIA() {
  await connection();
  const { sessao } = await contexto();
  if (!sessao.operadora) redirect("/descobrir");
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin" className="text-sm text-marca-700">← Plataforma</Link>
        <h1 className="titulo-pagina">Teste de IA (Gemini)</h1>
        <p className="sub-pagina">
          Chave {chaveGemini() ? "encontrada" : "não encontrada"} no ambiente
          {process.env.GEMINI_MODEL ? ` · modelo fixado: ${process.env.GEMINI_MODEL}` : " · modelo escolhido automaticamente (flash-lite mais novo)"}.
        </p>
      </header>
      <FormTesteIA />
    </div>
  );
}
