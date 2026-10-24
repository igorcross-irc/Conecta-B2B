import { redirect } from "next/navigation";

/** Endereço antigo: Pesquisar e Descobrir viraram uma só área. Links antigos (e-mails de aviso, favoritos) continuam funcionando. */
export default async function Descobrir({ searchParams }: PageProps<"/descobrir">) {
  const sp = await searchParams;
  const alvo = typeof sp.alvo === "string" ? sp.alvo : typeof sp.cnpj === "string" ? sp.cnpj : "";
  redirect(alvo ? `/empresa/${encodeURIComponent(alvo)}` : "/pesquisar");
}
