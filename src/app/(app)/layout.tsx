import { redirect } from "next/navigation";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { ErroDeNegocio } from "@/lib/servicos";
import { Logo } from "@/components/Logo";
import { Menu, type ItemMenu } from "@/components/Menu";
import { sair } from "../(site)/entrar/actions";
import { trocarOrganizacao } from "./acoes";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection();
  let c;
  try {
    c = await contexto();
  } catch (e) {
    if (e instanceof ErroDeNegocio && e.status === 401) redirect("/entrar");
    throw e;
  }
  const { sessao, servicos } = c;
  const saldo = await servicos.saldo();
  const itens: ItemMenu[] = [
    { href: "/pesquisar", rotulo: "Pesquisar", secao: "Prospecção" },
    { href: "/descobrir", rotulo: "Descobrir" },
    { href: "/base", rotulo: "Base comum", secao: "Prospecção" },
    { href: "/listas", rotulo: "Listas", secao: "Prospecção" },
    { href: "/importar", rotulo: "Importar", secao: "Prospecção" },
    { href: "/creditos", rotulo: "Créditos", secao: "Conta" },
    { href: "/equipe", rotulo: "Equipe", secao: "Conta" },
    { href: "/configuracoes", rotulo: "Configurações", secao: "Conta" },
    ...(sessao.operadora ? [{ href: "/admin", rotulo: "Plataforma", secao: "Operadora" }] : []),
  ];
  const ativa = sessao.orgs.find((o) => o.id === sessao.orgId);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-4 bg-marca-900 p-4 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto">
        <a href="/descobrir" aria-label="Conecta-B2B">
          <Logo claro />
        </a>
        {sessao.orgs.length > 1 ? (
          <form action={trocarOrganizacao}>
            <label className="sr-only" htmlFor="org">Organização</label>
            <select
              id="org"
              name="org"
              defaultValue={sessao.orgId}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-sm text-white"
            >
              {sessao.orgs.map((o) => (
                <option key={o.id} value={o.id} className="text-tinta">{o.nome}</option>
              ))}
            </select>
            <button className="mt-1 text-xs text-marca-200 underline">Trocar organização</button>
          </form>
        ) : (
          <p className="truncate text-sm text-marca-100">{ativa?.nome}</p>
        )}
        <div className="rounded-lg bg-white/10 px-3 py-2 text-sm">
          <span className="text-marca-200">Saldo</span>{" "}
          <a href="/creditos" className="font-semibold text-white">{saldo} créditos</a>
        </div>
        <Menu itens={itens} />
        <div className="border-t border-white/15 pt-3 text-xs text-marca-100">
          <p className="truncate font-medium text-white">{sessao.nome ?? sessao.email ?? "Usuário"}</p>
          {sessao.email && sessao.nome && <p className="truncate">{sessao.email}</p>}
          <p className="mt-0.5">{sessao.papel === "administrador" ? "Administrador" : "Membro"}</p>
          {!sessao.demo && (
            <form action={sair} className="mt-2">
              <button className="underline hover:text-white">Sair</button>
            </form>
          )}
          <a href="/optout" className="mt-2 block underline hover:text-white">Opt-out (LGPD)</a>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        {sessao.demo && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Modo de demonstração: sem login e com banco local. Em produção, cada pessoa entra com a sua conta.
          </p>
        )}
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
