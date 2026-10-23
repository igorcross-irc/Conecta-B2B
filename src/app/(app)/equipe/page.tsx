import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { alterarPapel, removerMembro, revogarConvite } from "../acoes";
import { FormConvite } from "./FormConvite";

export const metadata = { title: "Equipe" };

export default async function Equipe() {
  await connection();
  const { sessao, servicos } = await contexto();
  const { membros, convites } = await servicos.equipe();
  const admin = sessao.papel === "administrador";
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">Equipe</h1>
        <p className="sub-pagina">
          Quem acessa esta organização. Todos compartilham o mesmo saldo de créditos, listas e histórico de buscas.
        </p>
      </header>

      {admin && (
        <section className="cartao space-y-3">
          <h2 className="font-medium">Convidar pessoa</h2>
          <FormConvite />
        </section>
      )}

      <section className="cartao p-0">
        <h2 className="border-b border-slate-200 p-4 font-medium">Membros ({membros.length})</h2>
        <ul className="divide-y divide-slate-100">
          {membros.map((m) => (
            <li key={m.usuarioId} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{m.nome ?? m.email ?? m.usuarioId}</p>
                {m.nome && m.email && <p className="text-slate-500">{m.email}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={m.papel === "administrador" ? "selo" : "selo-cinza"}>
                  {m.papel === "administrador" ? "Administrador" : "Membro"}
                </span>
                {admin && (
                  <>
                    <form action={alterarPapel}>
                      <input type="hidden" name="usuario" value={m.usuarioId} />
                      <input type="hidden" name="papel" value={m.papel === "administrador" ? "membro" : "administrador"} />
                      <button className="btn-sec px-3 py-1 text-xs">
                        {m.papel === "administrador" ? "Tornar membro" : "Tornar administrador"}
                      </button>
                    </form>
                    <form action={removerMembro}>
                      <input type="hidden" name="usuario" value={m.usuarioId} />
                      <button className="btn-perigo px-3 py-1 text-xs">Remover</button>
                    </form>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {admin && convites.length > 0 && (
        <section className="cartao p-0">
          <h2 className="border-b border-slate-200 p-4 font-medium">Convites pendentes</h2>
          <ul className="divide-y divide-slate-100">
            {convites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{c.email}</p>
                  <p className="text-slate-500">
                    {c.papel === "administrador" ? "Administrador" : "Membro"} · expira em{" "}
                    {new Date(c.expiraEm).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <form action={revogarConvite}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn-perigo px-3 py-1 text-xs">Revogar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
