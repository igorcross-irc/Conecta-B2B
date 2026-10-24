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


## Verificação contra o Neon real (24/10/2026)

Feita com `set local role conecta_app` dentro de uma transação, só com leituras (o papel não tem login ainda):

- O papel **não** tem `BYPASSRLS`. Um membro da organização vê as próprias 29 pessoas, 6 buscas, 1 organização e 1 membro. Um usuário estranho (id inexistente) vê **zero** em `contato`, `busca_job`, `organizacao` e `membro`, e continua lendo a base pública da Receita (2,2 mi linhas).
- As 16 funções `security definer` (revelar, cobrar, convites, opt-out...) têm `execute` para o papel.
- `alter role conecta_app set statement_timeout = '20s'` e `grant conecta_app to current_user` aplicados (`db/neon/0016`).

**Ponto de atenção (defesa em camadas):** a política `app_contato_dado` deixa o papel do app ler `contato_dado` (e-mail e telefone completos) da própria organização. Quem impede de mostrar sem "revelar" (e sem cobrar) é o código do servidor (`visivel`), não o banco. Hoje não há caminho de usuário até esse SQL, mas um erro de código ou injeção de SQL ignoraria a cobrança. Melhoria futura: guardar o e-mail/telefone mascarado em `contato` e limitar a política de leitura às linhas já reveladas.

**Falta para ligar o papel em produção** (só você pode): trocar a senha do Neon que vazou, definir login e senha do papel (`alter role conecta_app login password '...'`) e pôr a nova `DATABASE_URL` na Vercel, como no passo a passo acima.
