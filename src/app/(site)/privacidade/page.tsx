export const metadata = { title: "Privacidade e LGPD" };

export default function Privacidade() {
  return (
    <article className="mx-auto max-w-2xl space-y-5 text-sm leading-relaxed text-slate-700">
      <h1 className="titulo-pagina">Privacidade e LGPD</h1>
      <p className="aviso-erro border-amber-200 bg-amber-50 text-amber-900">
        Texto de trabalho: descreve como a plataforma funciona hoje e deve ser revisado por um advogado antes do lançamento comercial.
      </p>

      <h2 className="text-base font-semibold text-tinta">O que tratamos</h2>
      <p>
        Dados cadastrais públicos de empresas (CNPJ, atividade, sócios e administradores informados à Receita Federal) e
        dados profissionais de contato de pessoas (nome, cargo, e-mail e telefone comerciais) obtidos de fontes abertas,
        como sites institucionais das próprias empresas, ou contribuídos por usuários. Não coletamos redes sociais por
        raspagem: endereços do LinkedIn só entram se forem públicos e informados por um usuário.
      </p>

      <h2 className="text-base font-semibold text-tinta">Base legal e finalidade</h2>
      <p>
        Legítimo interesse para prospecção comercial B2B (LGPD, art. 7º, IX), limitada a contatos profissionais, com
        transparência sobre a origem de cada dado e registro de quem contribuiu com ele.
      </p>

      <h2 className="text-base font-semibold text-tinta">Seus direitos</h2>
      <p>
        Você pode pedir a exclusão do seu e-mail e telefone profissionais a qualquer momento na página de{" "}
        <a className="underline" href="/optout">opt-out</a>. O pedido apaga os dados de contato em todas as bases e impede
        que voltem a ser listados ou importados.
      </p>

      <h2 className="text-base font-semibold text-tinta">Quem vê o quê</h2>
      <p>
        Cada organização enxerga apenas suas listas, saldo e histórico. A base comum compartilha dados públicos de empresas
        e contatos profissionais; e-mail e telefone só aparecem para quem os revela com crédito.
      </p>

      <h2 className="text-base font-semibold text-tinta">Retenção</h2>
      <p>Resultados de busca ficam guardados por até 30 dias antes de serem refeitos. Ações administrativas ficam em auditoria.</p>
    </article>
  );
}
