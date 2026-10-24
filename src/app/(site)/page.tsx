import Link from "next/link";

const PASSOS = [
  ["1", "Informe o CNPJ", "Trazemos razão social, atividade, porte, sócios e situação cadastral a partir de fontes abertas."],
  ["2", "Veja os decisores", "Sócios e administradores, mais contatos encontrados nos sites da empresa e na base comum, com origem e confiança."],
  ["3", "Revele e exporte", "Pague crédito só para revelar e-mail ou telefone. Monte listas e exporte em CSV."],
];

/** Fontes de dados ligadas hoje, mostradas na página para a origem do dado ficar clara. */
const FONTES = ["Receita Federal", "CVM", "Wikidata", "Google Notícias", "Portal da Transparência", "Sites das empresas"];

const RECURSOS = [
  ["Base que cresce com o uso", "Cada empresa pesquisada fica guardada e pode ser reaproveitada por todos. A segunda busca é mais rápida e mais completa que a primeira."],
  ["Colaborativa de verdade", "Corrija o site de uma empresa, deixe notas e tags, adicione contatos. O que você melhora vale para todos."],
  ["Cobrança justa", "Busca sem resultado e dado inexistente não gastam crédito. Revelar e-mail e telefone é opcional."],
  ["Equipes e permissões", "Organizações separadas, convites por link, administradores e membros, saldo compartilhado e auditoria."],
  ["Pesquisa por filtros e por pergunta", "Atividade, cidade, setor, porte e idade da empresa, com sugestões ao digitar. Ou descreva em português o que procura e a IA preenche os filtros."],
  ["Mais do que o cadastro", "CVM (diretor de relações com investidores), Wikidata (funcionários e receita), notícias dos últimos 30 dias e sanções federais, cada fonte com a origem à mostra."],
  ["Avisos e integrações", "Salve uma pesquisa e receba por e-mail as empresas novas. Exporte para HubSpot, RD Station e Pipedrive ou use a API."],
  ["Fontes abertas primeiro", "Receita Federal via APIs públicas e sites institucionais. Fontes pagas podem ser plugadas depois sem refazer nada."],
  ["LGPD no centro", "Opt-out público que apaga dados em todas as bases, só contatos profissionais e transparência sobre a origem."],
];

export default function Landing() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-2 md:pt-6 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="selo">Prospecção B2B para o Brasil</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-tinta sm:text-4xl xl:text-5xl">
            Descubra quem decide dentro de qualquer empresa, <span className="text-marca-700">a partir do CNPJ</span>.
          </h1>
          <p className="text-lg text-slate-600">
            Decisores, cargos e contatos profissionais numa base colaborativa que fica melhor a cada busca. Comece com
            fontes abertas, sem mensalidade e sem cartão.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/entrar?novo=1" className="btn-destaque px-6 py-3 text-base">Começar grátis</Link>
            <Link href="/privacidade" className="btn-sec px-6 py-3 text-base">Como tratamos os dados</Link>
          </div>
        </div>

        <div className="cartao space-y-4 bg-marca-900 text-white shadow-xl" aria-hidden="true">
          <p className="text-xs uppercase tracking-wider text-marca-200">Exemplo de resultado</p>
          <div>
            <p className="text-lg font-semibold">Indústria Exemplo S.A.</p>
            <p className="text-xs text-marca-200">00.000.000/0001-00 · Campinas/SP · Fabricação de máquinas</p>
          </div>
          {[
            ["Marina Alves", "Diretora Comercial", "Sócios da Receita", "50%"],
            ["Paulo Reis", "Gerente de Compras", "Site da empresa", "70%"],
            ["Ana Lima", "Diretora Financeira", "Base comum", "60%"],
          ].map(([n, c, o, p]) => (
            <div key={n} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-sm">
              <span>
                <b>{n}</b> <span className="text-marca-100">· {c}</span>
                <span className="block text-xs text-marca-200">{o} · confiança {p}</span>
              </span>
              <span className="rounded-md bg-destaque px-2 py-1 text-xs font-semibold text-tinta">Revelar</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600" aria-label="Fontes de dados">
        <span className="font-medium">Dados de:</span>
        {FONTES.map((f) => <span key={f} className="chip cursor-default hover:border-slate-200 hover:text-slate-700">{f}</span>)}
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Como funciona</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {PASSOS.map(([n, t, d]) => (
            <li key={n} className="cartao">
              <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-marca-700 text-sm font-bold text-white">{n}</span>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Feito para times de vendas e prospecção</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(([t, d]) => (
            <div key={t} className="cartao">
              <h3 className="font-semibold text-marca-700">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cartao space-y-2 border-marca-200 bg-marca-50">
        <h2 className="text-xl font-bold">Transparência sobre a precisão</h2>
        <p className="text-sm text-slate-700">
          Fontes abertas dão menos cobertura que bases pagas. Por isso cada contato mostra de onde veio e um nível de
          confiança, e você só gasta crédito quando decide revelar. Conforme a base cresce, e com fontes melhores
          conectadas, a cobertura aumenta.
        </p>
      </section>

      <section className="rounded-2xl bg-marca-900 p-10 text-center text-white">
        <h2 className="text-2xl font-bold">Comece pela sua primeira empresa</h2>
        <p className="mx-auto mt-2 max-w-xl text-marca-100">Crie a conta, receba créditos de teste e pesquise um CNPJ em menos de um minuto.</p>
        <Link href="/entrar?novo=1" className="btn-destaque mt-6 px-6 py-3 text-base">Criar conta grátis</Link>
      </section>
    </div>
  );
}
