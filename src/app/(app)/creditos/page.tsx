import { Suspense } from "react";
import { connection } from "next/server";
import { servicos } from "@/lib/app";

const ROTULO: Record<string, string> = {
  busca_decisores: "Busca de decisores",
  revelar_email: "Revelar e-mail",
  revelar_telefone: "Revelar telefone",
  recarga: "Recarga",
  estorno: "Estorno",
};

async function Conteudo() {
  await connection(); // lê estado do servidor a cada requisição
  const s = await servicos();
  const extrato = await s.extrato();
  const custos = await s.custos();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Créditos</h1>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Saldo disponível</p>
          <p className="text-4xl font-semibold text-marca-700">{await s.saldo()}</p>
          <p className="mt-1 text-xs text-slate-500">
            Os créditos não expiram.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p className="mb-2 font-medium">Custo por operação</p>
          <ul className="space-y-1 text-slate-600">
            <li>Busca de decisores: {custos.busca_decisores}</li>
            <li>Revelar e-mail: {custos.revelar_email}</li>
            <li>Revelar telefone: {custos.revelar_telefone}</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Busca sem resultado e dado inexistente não são cobrados.
          </p>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-4 font-medium">Extrato</h2>
        {extrato.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Nenhuma movimentação ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="p-3">Quando</th>
                <th className="p-3">Operação</th>
                <th className="p-3">Descrição</th>
                <th className="p-3 text-right">Créditos</th>
                <th className="p-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {extrato.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(l.criadoEm).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3">{ROTULO[l.operacao]}</td>
                  <td className="p-3 text-slate-600">{l.descricao}</td>
                  <td className={`p-3 text-right ${l.valor < 0 ? "text-red-600" : "text-green-700"}`}>
                    {l.valor > 0 ? `+${l.valor}` : l.valor}
                  </td>
                  <td className="p-3 text-right">{l.saldoApos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default function Creditos() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}
