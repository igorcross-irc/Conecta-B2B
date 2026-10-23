import Link from "next/link";
import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { ErroDeNegocio } from "@/lib/servicos";
import { aceitarConvite } from "../../../(app)/acoes";

export const metadata = { title: "Convite" };

export default async function Convite({ params, searchParams }: PageProps<"/convite/[token]">) {
  await connection();
  const { token } = await params;
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : "";
  let logado = true;
  try {
    await contexto();
  } catch (e) {
    if (e instanceof ErroDeNegocio && e.status === 401) logado = false;
    else throw e;
  }
  const proximo = encodeURIComponent(`/convite/${token}`);
  return (
    <div className="mx-auto max-w-md space-y-4 pt-8">
      <h1 className="titulo-pagina">Você foi convidado</h1>
      <p className="sub-pagina">Aceite para entrar na organização e usar o saldo, as listas e a base da equipe.</p>
      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
      {logado ? (
        <form action={aceitarConvite}>
          <input type="hidden" name="token" value={token} />
          <button className="btn-primario">Aceitar convite</button>
        </form>
      ) : (
        <div className="flex gap-3">
          <Link href={`/entrar?proximo=${proximo}`} className="btn-primario">Entrar ou criar conta</Link>
        </div>
      )}
    </div>
  );
}
