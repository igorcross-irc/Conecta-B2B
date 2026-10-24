import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="titulo-pagina">Página não encontrada</h1>
      <p className="sub-pagina">O endereço não existe ou foi movido.</p>
      <Link href="/" className="btn-primario">Ir para o início</Link>
    </div>
  );
}
