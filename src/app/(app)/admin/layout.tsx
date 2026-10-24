import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AbasPagina } from "@/components/AbasPagina";
import { contexto } from "@/lib/app";

/** Área da operadora: só quem é operadora entra, e todas as subpáginas ganham o mesmo cabeçalho e as mesmas abas. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  const { sessao } = await contexto();
  if (!sessao.operadora) redirect("/descobrir");
  return (
    <div className="space-y-5">
      <header>
        <h1 className="titulo-pagina">Plataforma</h1>
        <p className="sub-pagina">Visão da operadora: organizações, créditos, fontes de dados e saúde do sistema.</p>
      </header>
      <AbasPagina
        rotulo="Áreas da plataforma"
        abas={[
          { href: "/admin", rotulo: "Visão geral" },
          { href: "/admin/provedores", rotulo: "Fontes de dados" },
          { href: "/admin/saude", rotulo: "Saúde" },
          { href: "/admin/ia", rotulo: "IA e chaves" },
        ]}
      />
      {children}
    </div>
  );
}
