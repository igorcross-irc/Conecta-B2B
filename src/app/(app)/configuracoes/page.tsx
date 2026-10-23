import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { FormNome } from "./FormNome";

export const metadata = { title: "Configurações" };

const ROTULO_ACAO: Record<string, string> = {
  "organizacao.renomear": "Renomeou a organização",
  "equipe.convidar": "Convidou",
  "equipe.revogar_convite": "Revogou convite",
  "equipe.papel": "Alterou papel",
  "equipe.remover": "Removeu membro",
  "base.empresa": "Atualizou empresa na base",
  "base.contato": "Adicionou contato à base",
  "admin.recarga": "Recarga de créditos (operadora)",
  "admin.custos": "Custos alterados (operadora)",
};

export default async function Configuracoes() {
  await connection();
  const { sessao, servicos } = await contexto();
  const org = await servicos.organizacao();
  const admin = sessao.papel === "administrador";
  const auditoria = admin ? await servicos.auditoriaRecente(40) : [];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-pagina">Configurações</h1>
        <p className="sub-pagina">Dados da organização e histórico de ações administrativas.</p>
      </header>

      <section className="cartao space-y-3">
        <h2 className="font-medium">Organização</h2>
        {admin ? <FormNome nome={org.nome} /> : <p className="text-sm">{org.nome}</p>}
        <p className="text-xs text-slate-500">
          Criada em {new Date(org.criadaEm).toLocaleDateString("pt-BR")} · saldo {org.saldo} créditos
        </p>
      </section>

      <section className="cartao text-sm">
        <h2 className="mb-2 font-medium">Custos desta organização</h2>
        <ul className="space-y-1 text-slate-600">
          <li>Busca de decisores: {org.custos.busca_decisores} crédito(s)</li>
          <li>Revelar e-mail: {org.custos.revelar_email} crédito(s)</li>
          <li>Revelar telefone: {org.custos.revelar_telefone} crédito(s)</li>
        </ul>
      </section>

      {admin && (
        <section className="cartao p-0">
          <h2 className="border-b border-slate-200 p-4 font-medium">Auditoria</h2>
          {auditoria.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nada registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {auditoria.map((a, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 p-3">
                  <span>
                    <span className="font-medium">{ROTULO_ACAO[a.acao] ?? a.acao}</span>
                    {a.alvo && <span className="text-slate-500"> · {a.alvo}</span>}
                    {a.quem && <span className="text-slate-500"> · por {a.quem}</span>}
                  </span>
                  <time className="text-slate-500">{new Date(a.quando).toLocaleString("pt-BR")}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
