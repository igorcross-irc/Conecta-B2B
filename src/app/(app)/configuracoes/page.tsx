import { connection } from "next/server";
import { contexto } from "@/lib/app";
import { FormNome } from "./FormNome";
import { FormPerfil } from "./FormPerfil";
import { FormChaveApi } from "./FormChaveApi";
import { revogarChaveApiAcao } from "../acoes";

export const metadata = { title: "Configurações" };

const ROTULO_ACAO: Record<string, string> = {
  "organizacao.renomear": "Renomeou a organização",
  "equipe.convidar": "Convidou",
  "equipe.revogar_convite": "Revogou convite",
  "equipe.papel": "Alterou papel",
  "equipe.remover": "Removeu membro",
  "base.empresa": "Atualizou empresa na base",
  "base.contato": "Adicionou contato à base",
  "api.criar_chave": "Criou chave de API",
  "api.revogar_chave": "Revogou chave de API",
  "organizacao.perfil_ideal": "Atualizou o perfil de cliente ideal",
  "pesquisa.salvar": "Salvou pesquisa",
  "admin.recarga": "Recarga de créditos (operadora)",
  "admin.custos": "Custos alterados (operadora)",
};

export default async function Configuracoes() {
  await connection();
  const { sessao, servicos } = await contexto();
  const org = await servicos.organizacao();
  const admin = sessao.papel === "administrador";
  const chaves = admin ? await servicos.chavesApi() : [];
  const perfil = await servicos.perfilIdeal();
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

      <section id="perfil-ideal" className="cartao space-y-3 text-sm">
        <h2 className="font-medium">Perfil de cliente ideal</h2>
        <p className="text-slate-600">
          Marque como é o seu cliente ideal. A pesquisa mostra, em cada empresa, quanto ela combina com esse perfil (de 0 a 100%) e pode ordenar por isso.
          Só conta o que você marcar aqui.
        </p>
        {admin ? <FormPerfil perfil={perfil} /> : <p className="text-slate-500">Somente administradores editam o perfil.</p>}
      </section>

      {admin && (
        <section className="cartao space-y-3 text-sm">
          <h2 className="font-medium">Chaves de API</h2>
          <p className="text-slate-600">
            Acesso somente leitura e sem custo (ficha da empresa, pesquisa e saldo) para integrar com outros sistemas.
            Veja os endereços em <code>docs/api.md</code>.
          </p>
          <FormChaveApi />
          {chaves.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {chaves.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{k.nome}</span> <code className="text-xs text-slate-500">{k.prefixo}…</code>
                    <span className="block text-xs text-slate-500">
                      criada em {new Date(k.criadaEm).toLocaleDateString("pt-BR")}
                      {k.ultimoUso ? ` · último uso ${new Date(k.ultimoUso).toLocaleString("pt-BR")}` : " · nunca usada"}
                      {k.revogada ? " · revogada" : ""}
                    </span>
                  </span>
                  {!k.revogada && (
                    <form action={revogarChaveApiAcao}>
                      <input type="hidden" name="id" value={k.id} />
                      <button className="text-xs text-slate-500 underline">Revogar</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
