import { redirect } from "next/navigation";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { ErroDeNegocio } from "@/lib/erros";
import { Logo, LogoIcone } from "@/components/Logo";
import { BarraProgresso } from "@/components/BarraProgresso";
import { Menu, type ItemMenu } from "@/components/Menu";
import { PainelLateral } from "@/components/PainelLateral";
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
    { href: "/pesquisar", rotulo: "Pesquisar", icone: "Busca", secao: "Prospecção" },
    { href: "/empresas", rotulo: "Minhas empresas", icone: "Predio", secao: "Prospecção" },
    { href: "/mercado", rotulo: "Mercado", icone: "Grafico", secao: "Prospecção" },
    { href: "/base", rotulo: "Base comum", icone: "Base", secao: "Prospecção" },
    { href: "/listas", rotulo: "Listas", icone: "Listas", secao: "Prospecção" },
    { href: "/importar", rotulo: "Importar", icone: "Importar", secao: "Prospecção" },
    { href: "/creditos", rotulo: "Créditos", icone: "Creditos", secao: "Conta" },
    { href: "/equipe", rotulo: "Equipe", icone: "Equipe", secao: "Conta" },
    { href: "/configuracoes", rotulo: "Configurações", icone: "Config", secao: "Conta" },
    ...(sessao.operadora ? [{ href: "/admin", rotulo: "Plataforma", icone: "Plataforma" as const, secao: "Operadora" }] : []),
  ];
  const ativa = sessao.orgs.find((o) => o.id === sessao.orgId);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <BarraProgresso />
      <PainelLateral
        logo={<Logo claro />}
        saldo={saldo}
        atalhos={[
          { href: "/pesquisar", rotulo: "Pesquisar", icone: "Busca" },
          { href: "/empresas", rotulo: "Empresas", icone: "Predio" },
          { href: "/listas", rotulo: "Listas", icone: "Listas" },
          { href: "/base", rotulo: "Base", icone: "Base" },
        ]}
      >
        <a href="/pesquisar" aria-label="Conecta-B2B" className="hidden md:block">
          <span className="hidden xl:block"><Logo claro /></span>
          <span className="flex justify-center xl:hidden"><LogoIcone tamanho={40} /></span>
        </a>
        <div className="space-y-3 md:hidden xl:block">
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
          <a href="/creditos" className="flex items-baseline justify-between rounded-xl bg-white/10 px-3 py-2.5 text-sm hover:bg-white/15">
            <span className="text-marca-200">Saldo</span>
            <span className="font-semibold text-white">{saldo} créditos</span>
          </a>
        </div>
        <a href="/creditos" title={`Saldo: ${saldo} créditos`} className="hidden rounded-xl bg-white/10 py-2 text-center text-xs font-semibold text-white hover:bg-white/15 md:block xl:hidden">
          {saldo}
          <span className="block text-[10px] font-normal text-marca-200">créd.</span>
        </a>
        <Menu itens={itens} />
        <div className="border-t border-white/15 pt-3 text-xs text-marca-100">
          <div className="hidden justify-center md:flex xl:hidden" title={sessao.nome ?? sessao.email ?? "Usuário"}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-marca-600 text-sm font-semibold text-white">
              {(sessao.nome ?? sessao.email ?? "U").trim().charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="md:hidden xl:block">
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
          {!sessao.demo && (
            <form action={sair} className="mt-2 hidden justify-center md:flex xl:hidden">
              <button className="underline hover:text-white" title="Sair">Sair</button>
            </form>
          )}
        </div>
      </PainelLateral>
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-8 xl:p-8">
        {sessao.demo && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Modo de demonstração: sem login e com banco local. Em produção, cada pessoa entra com a sua conta.
          </p>
        )}
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
