import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { alvoValido, chaveAlvo } from "@/lib/cnpj";
import { chaveGemini } from "@/lib/ia/gemini";
import Descobrir from "./Descobrir";

export const metadata = { title: "Empresa" };

/** Só volta para telas do próprio aplicativo (nunca para um endereço de fora). */
function destinoDeVolta(de: unknown): { href: string; rotulo: string } {
  const d = typeof de === "string" ? de : "";
  if (d.startsWith("/empresas")) return { href: d, rotulo: "Voltar para Minhas empresas" };
  if (d.startsWith("/listas")) return { href: d, rotulo: "Voltar para as listas" };
  if (d.startsWith("/mercado") || d.startsWith("/parecidas")) return { href: d, rotulo: "Voltar" };
  if (d.startsWith("/pesquisar")) return { href: d, rotulo: "Voltar para os resultados" };
  return { href: "/pesquisar", rotulo: "Voltar para a pesquisa" };
}

/** Página única de uma empresa: ficha, pessoas, informações extras e sócios. Aceita CNPJ (com ou sem pontuação) ou "site:dominio". */
export default async function PaginaEmpresa({ params, searchParams }: PageProps<"/empresa/[alvo]">) {
  await connection();
  const [{ alvo: bruto }, sp] = await Promise.all([params, searchParams]);
  const alvo = decodeURIComponent(bruto);
  if (!alvoValido(alvo)) notFound();
  const canonico = chaveAlvo(alvo);
  if (canonico !== alvo) redirect(`/empresa/${encodeURIComponent(canonico)}${typeof sp.de === "string" ? `?de=${encodeURIComponent(sp.de)}` : ""}`);
  const { servicos } = await contexto();
  const custos = await servicos.custos();
  const voltar = destinoDeVolta(sp.de);
  return (
    <div className="space-y-4">
      <nav aria-label="Navegação"><Link href={voltar.href} className="inline-flex items-center gap-1 text-sm text-marca-700 hover:underline">← {voltar.rotulo}</Link></nav>
      <Descobrir cnpjInicial={canonico} iaAtiva={Boolean(chaveGemini())} custos={{ busca: custos.busca_decisores, email: custos.revelar_email, telefone: custos.revelar_telefone }} />
    </div>
  );
}
