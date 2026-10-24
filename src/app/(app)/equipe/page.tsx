import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { alterarPapel, removerMembro, revogarConvite } from "../acoes";
import { FormConvite } from "./FormConvite";

export const metadata = { title: "Equipe" };

const iniciais = (t: string) => t.trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

export default async function Equipe() {
  await connection();
  const { sessao, servicos } = await contexto();
  const { membros, convites } = await servicos.equipe();
  const admin = sessao.papel === "administrador";
  const admins = membros.filter((m) => m.papel === "administrador").length;

  return (
    <div className="space-y-5">
      <header className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Equipe</h1>
          <p className="sub-pagina max-w-2xl">Quem acessa esta organização. Todos compartilham o mesmo saldo de créditos, listas e histórico de buscas.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="kpi text-center"><p className="kpi-valor">{membros.length}</p><p className="kpi-rotulo">membros</p></div>
          <div className="kpi text-center"><p className="kpi-valor">{admins}</p><p className="kpi-rotulo">administradores</p></div>
          {admin && <div className="kpi text-center"><p className="kpi-valor">{convites.length}</p><p className="kpi-rotulo">convites</p></div>}
        </div>
      </header>

      {admin ? (
        <section className="cartao-destaque space-y-3">
          <h2 className="font-semibold text-marca-800">Convidar pessoa</h2>
          <FormConvite />
        </section>
      ) : (
        <p className="aviso-ok border-slate-200 bg-slate-50 text-slate-700">Só administradores convidam pessoas e mudam papéis.</p>
      )}

      <section className="cartao p-0">
        <h2 className="border-b border-slate-100 p-4 font-semibold">Membros</h2>
        <ul className="divide-y divide-slate-100">
          {membros.map((m) => {
            const nome = m.nome ?? m.email ?? m.usuarioId;
            const euMesmo = m.usuarioId === sessao.usuarioId;
            return (
              <li key={m.usuarioId} className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca-50 font-semibold text-marca-700" aria-hidden>{iniciais(nome)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{nome}{euMesmo && <span className="ml-2 selo-cinza">você</span>}</p>
                    {m.nome && m.email && <p className="truncate text-slate-500">{m.email}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={m.papel === "administrador" ? "selo" : "selo-cinza"}>{m.papel === "administrador" ? "Administrador" : "Membro"}</span>
                  {admin && (
                    <>
                      <form action={alterarPapel}>
                        <input type="hidden" name="usuario" value={m.usuarioId} />
                        <input type="hidden" name="papel" value={m.papel === "administrador" ? "membro" : "administrador"} />
                        <button className="btn-sec min-h-8 px-3 py-1 text-xs">{m.papel === "administrador" ? "Tornar membro" : "Tornar administrador"}</button>
                      </form>
                      <form action={removerMembro}>
                        <input type="hidden" name="usuario" value={m.usuarioId} />
                        <button className="btn-perigo min-h-8 px-3 py-1 text-xs">Remover</button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {admin && convites.length > 0 && (
        <section className="cartao p-0">
          <h2 className="border-b border-slate-100 p-4 font-semibold">Convites pendentes</h2>
          <ul className="divide-y divide-slate-100">
            {convites.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.email}</p>
                  <p className="text-slate-500">{c.papel === "administrador" ? "Administrador" : "Membro"} · expira em {new Date(c.expiraEm).toLocaleDateString("pt-BR")}</p>
                </div>
                <form action={revogarConvite}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn-perigo min-h-8 px-3 py-1 text-xs">Revogar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
