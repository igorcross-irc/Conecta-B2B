# Papel de banco limitado (`conecta_app`)

Até a migração 0008 o app conectava no Neon como dono do banco (`neondb_owner`), que **ignora a segurança por linha (RLS)**.
O isolamento entre organizações dependia de cada consulta lembrar do `where organizacao_id = ...`. Com o papel `conecta_app`
o próprio banco recusa ler ou escrever dados de outra organização.

## Como ligar (uma vez)

1. Aplique `db/neon/0007_limite_e_optout.sql` e `db/neon/0008_papel_app.sql` no Neon (SQL Editor, como dono).
2. Dê login ao papel, com uma senha longa gerada por você (não a coloque em arquivo do repositório):
   ```sql
   alter role conecta_app login password '<senha-longa-gerada>';
   ```
3. Monte a nova `DATABASE_URL` trocando usuário e senha pelos de `conecta_app` (mesmo host e banco) e atualize na Vercel
   (production e preview). Faça o redeploy.
4. Mantenha a URL do **dono** só para o que precisa dela: migrações e o workflow `Importar Receita` (secret `DATABASE_URL`
   do GitHub). O app em produção não deve mais usá-la.

## Como foi verificado

- `npm run test:papel` roda a suíte inteira de serviços (41 testes) como `conecta_app`, com o usuário declarado como em produção.
- `src/db/migracao.test.ts` confirma que o papel não tem `BYPASSRLS`, não é superusuário, não cria tabelas, não lê nem escreve em outra organização.
- NÃO foi verificado contra o Neon real (o ambiente de desenvolvimento não alcança o banco). Depois de trocar a URL, teste: entrar,
  buscar pessoas, revelar um contato, listas, equipe e `/admin`. Para voltar atrás, restaure a URL anterior.

## O que o papel pode

- Tabelas de cada organização (`contato`, `contato_dado`, `lista`, `credito_lancamento`, `busca_job`, `convite`, ...): só as da
  organização em que o usuário é membro (a operadora enxerga as de todas, onde a tela de plataforma precisa).
- Dados compartilhados por desenho (cache de empresas, pool de buscas, base comum, base da Receita) e tabelas internas
  (`opt_out`, `limite_pedido`, `optout_pedido`, `operadora`): acesso livre, porque não têm dono.
- O opt-out, que apaga dados de todas as organizações, roda pela função `aplicar_opt_out`, e não por acesso irrestrito.
