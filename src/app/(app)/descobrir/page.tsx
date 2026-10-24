import { connection } from "next/server";
import { contexto } from "@/lib/app";
import Link from "next/link";
import { chaveGemini } from "@/lib/ia/gemini";
import Descobrir from "./Descobrir";

export const metadata = { title: "Descobrir" };

export default async function Pagina({ searchParams }: PageProps<"/descobrir">) {
  await connection();
  const sp = await searchParams;
  const alvo = typeof sp.alvo === "string" ? sp.alvo : typeof sp.cnpj === "string" ? sp.cnpj : "";
  const { servicos } = await contexto();
  const recentes = await servicos.buscasRecentes(8);
  return (
    <div className="space-y-6">
      <Descobrir cnpjInicial={alvo} iaAtiva={Boolean(chaveGemini())} />
      {recentes.length > 0 && (
        <section className="cartao">
          <h2 className="mb-2 font-medium">Buscas recentes da equipe</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {recentes.map((b) => (
              <li key={b.id} className="flex justify-between gap-3 py-2">
                <Link href={`/descobrir?alvo=${encodeURIComponent(b.cnpj)}`} className="font-medium text-marca-700 hover:underline">
                  {b.empresa}
                </Link>
                <span className="text-slate-500">{b.status} · {new Date(b.quando).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
