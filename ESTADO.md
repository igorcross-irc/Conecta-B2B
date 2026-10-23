# Estado do projeto

Atualizado em 21/10/2026.

## Objetivo
Direção definida em 21/10/2026: sistema B2B para apoiar áreas de vendas de qualquer segmento, com personalização por tenant. Não fica restrito a rádio nem a veículos de comunicação (ver docs/visao-produto.md). ConnectLeads e SPYADS são referências funcionais.

Criar um sistema igual ao ConnectLeads. Projeto independente: não tem relação com o trabalho do Igor nem com empresa dele. A inspiração vem de um vídeo de demonstração que foi compartilhado e de informação pública do site lead.connectmix.com. Referências: o site, o vídeo e o levantamento do site (arquivo no projeto "Leads" do Claude).

## Feito
- Especificação funcional do app logado, a partir de 120 quadros do vídeo.
- Levantamento da landing, telas de acesso, rotas, FAQ e dados legais (projeto "Leads"), consolidado na especificação.
- Transcrição do áudio do vídeo (docs/transcricao-video.txt).
- Stack provável identificada: SPA React, Lovable, Supabase.

- Comparativo com o módulo "Contatos de marketing" do SPYADS (docs/comparativo-spyads-connectleads.md), usado só como referência funcional.
- Pesquisa de concorrentes e referências (docs/pesquisa-concorrentes.md). Falta a parte de dados de empresas no Brasil (Econodata, Speedio, Casa dos Dados).
- Pesquisa de fontes de dados para contatos e empresas (docs/fontes-de-dados.md): base de CNPJ, provedores com API, risco do LinkedIn e LGPD.
- Classificação de fontes em gratuito, pago e IA, conta por contato e roteiro do teste de provedores (docs/custos-e-roteiro-de-teste.md).
- Piloto de alimentos com 5 empresas e fontes gratuitas (docs/piloto-alimentos.md): nomes e cargos de grandes empresas aparecem na imprensa; e-mail e telefone não; dados de pequenas empresas, não.
- Primeira versão do código (Next.js 16, TypeScript, Tailwind, Vitest): consulta de CNPJ, busca de decisores em cascata, créditos com estorno, revelação paga, listas e CSV, telas Descobrir, Listas e Créditos. Migração SQL do Supabase com segurança por linha, testada em Postgres embutido. 46 testes passando e build ok. Os dados persistem num Postgres local embutido (PGlite, pasta `.dados`) com a mesma migração, porque o plano gratuito do Supabase do Igor já tem 2 projetos; Supabase fica para depois. Como rodar: ver README.

## Falta
- Navegar pelas telas internas que o vídeo não mostra: Importações, Equipe, Configurações, /admin e modais. Exige sessão nova do Claude ou modo de permissão manual.
- Executar o teste de provedores (roteiro em docs/custos-e-roteiro-de-teste.md): falta definir as 50 empresas e o verificador de e-mail. Baixar a base aberta de CNPJ (ver docs/fontes-de-dados.md).
- Validar base legal e opt-out com advogado.
- Ligar a aplicação ao Supabase (login, organizações, papéis, trocando o banco local pelo Supabase ou outro Postgres; decisão adiada porque as 2 vagas gratuitas estão ocupadas).
- Integrar o primeiro provedor real de contatos depois do teste.
- Painel da operadora, importação, sinais de compra e configuração por tenant.

## Decisões em aberto
1. Landing promete busca por raio e avaliações do Google Maps, CNPJ/QSA e 7 departamentos de decisores; o app do vídeo mostra bem menos. O que construir?
2. Preços: landing diz "sob consulta", app mostra R$ 0,60 a R$ 0,78 por crédito.
3. Bounce de e-mail: "0%" na tabela comparativa e "abaixo de 2%" no FAQ. Não replicar a inconsistência.
4. E-mail pessoal no perfil do contato (dito no vídeo) versus LGPD só com contato profissional (dito no site).
5. Adotar do SPYADS: contagem de contatos disponíveis, prévia grátis, teto de 7 por desbloqueio, busca assíncrona com progresso, controladora com confirmação. Confirmar com o Igor.
6. Sinais de compra: rádio é só um tipo de sinal. Definir quais entram na primeira versão e a fonte de cada um (a captura de rádio continua sem origem definida).
7. Primeiro tenant e segmento, e se o acesso é por autoatendimento ou operado por nós (ver perguntas em docs/visao-produto.md).

## Observação sobre a especificação
O parágrafo de abertura de docs/especificacao-funcional.md ainda diz que o site não pôde ser lido. Está desatualizado: as seções finais incorporam o levantamento do site e o áudio.

- 21/10/2026: criado o projeto Neon "Conecta B2B" (região aws-eu-central-1, id round-resonance-16677490) e aplicado o esquema (`db/neon/0001_neon.sql`, sem dados). A aplicação já tem o adaptador: com DATABASE_URL em .env.local (segredo, nunca no repositório) usa o Neon; sem ela usa o banco local. O SQL de semente e a cobrança foram validados no Neon (e desfeitos). Ainda não testado com o app rodando contra o Neon (meu ambiente não alcança a URL). Falta ligar o login (Neon Auth já provisionado) e trocar o usuário fixo de demonstração. Para testes a região Europa (Frankfurt) foi escolhida pelo Igor por ter storage.

- 21/10/2026 (noite): construídos e testados (59 testes): contexto por sessão (usuário e organização) e custos por tenant lidos de config_tenant; opt-out com apagamento dos dados e página pública; importação de CSV próprio; sinais de compra por CNPJ; script `scripts/testar-provedores.ts` (cobertura a partir de um CSV de CNPJs, respeita os 5 por minuto da CNPJá); login com Neon Auth (SDK `@neondatabase/auth`, páginas protegidas por `src/proxy.ts`, organização criada no primeiro acesso por `garantir_organizacao`, migração 0002 já aplicada no Neon). NÃO verificado: o login contra o Neon Auth real (meu ambiente não alcança a URL) e o app rodando contra o Neon. Pendências: confirmar o login na máquina do Igor; opt-out sem confirmação por e-mail nem limite de abuso; papel de banco limitado (hoje o app conecta como dono, que ignora a segurança por linha); adaptador do Apollo (a documentação não traz o formato da resposta; escrever depois de ver uma resposta real); lista dos 50 CNPJs de alimentos fornecida pelo Igor.

- 22/10/2026 (manhã): decisão do Igor: começar com ferramentas GRATUITAS de busca, aceitando menos precisão, e incorporar fontes melhores depois. Implementado e testado (70 testes, typecheck e build ok):
  - `src/lib/providers/brasilapi.ts`: BrasilAPI como fonte de empresa (traz o nome completo dos sócios, que a CNPJá aberta mascara) e `EmpresaEmCascata` (BrasilAPI, depois CNPJá; uma completa a outra; falha de uma não derruba a outra).
  - `src/lib/providers/socios.ts`: decisores a partir do quadro societário da Receita (sócios, administradores, diretores). Sem e-mail nem telefone de pessoa. Bom para empresa pequena e média.
  - `src/lib/providers/site.ts`: lê páginas públicas do site da empresa (/, /contato, /fale-conosco, /sobre, /quem-somos, /equipe), extrai e-mails do próprio domínio (inclusive os escondidos pelo Cloudflare) e telefones. Respeita robots.txt, identifica-se no User-Agent, bloqueia rede interna (SSRF) e entra como "não verificado" com a origem registrada. Sem IA.
  - Padrão do app agora são essas fontes (sem `CONECTA_MODO_DEMO=1`). `.env.example` ainda vem com o modo demonstração ligado: apague a linha para usar as fontes reais. Provedores pagos entram à frente na lista de `src/lib/app.ts`, sem mexer no resto.
  - Opt-out público com limite de 5 pedidos por hora por IP (`src/lib/limite.ts`, na memória do processo).
  - NÃO verificado: o formato real da resposta da BrasilAPI (escrito pela documentação; meu ambiente não alcança a API) e a leitura de sites reais. Confirmar na máquina do Igor rodando `npx tsx scripts/testar-provedores.ts docs/modelo-cnpjs.csv`.
  - Limites conhecidos das fontes grátis: o domínio do site vem do e-mail cadastral na Receita (muitas vezes da contabilidade, então o site pode não ser achado); não há descoberta de site por nome da empresa; sem LinkedIn; sem verificação de e-mail além de "veio do site da própria empresa".
  - Próximos passos grátis: descobrir o site pela razão social/nome fantasia (ex.: campo para o usuário informar o site; busca em fonte permitida), verificação de domínio por MX, base aberta de CNPJ baixada para busca por CNAE/cidade (Descobrir sem consulta unitária), Gupy/PNCP para sinais.
  - Pendente que exige o Igor: papel de banco limitado (precisa gerar senha nova e trocar a DATABASE_URL; não apliquei no Neon sozinho), confirmação do opt-out por e-mail (precisa de serviço de envio), login real no Neon Auth, lista dos 50 CNPJs.

- 23/10/2026: pool compartilhado e busca em segundo plano (82 testes, typecheck, lint e build ok; fluxo testado por HTTP em modo demonstração).
  - Migração `0003_pool_e_buscas.sql` (em `supabase/migrations` e `db/neon`): tabelas `pool_busca` (resultado da varredura por empresa, fontes e cargos; compartilhado entre organizações; validade de 30 dias com resultado e 1 dia sem; sem política de leitura) e `busca_job` (busca em andamento por organização). APLICAR NO NEON antes de usar o app contra ele.
  - O pool é chaveado também pelo conjunto de fontes: trocar ou acrescentar uma fonte (ex.: um provedor pago) gera varredura nova. Falha total das fontes não entra no pool. Opt-out remove a pessoa do pool.
  - Cada organização continua pagando o próprio crédito ao trazer os contatos; o pool só evita repetir a varredura. Prévia grátis: `GET /api/decisores/disponiveis?cnpj=`.
  - Busca em segundo plano: `POST /api/decisores/busca` (cobra e responde na hora; o trabalho roda em `after()` do Next), `GET /api/decisores/busca/{id}` (andamento por etapa) e `GET /api/decisores/busca?cnpj=` (retoma a última busca em 24 h). Uma busca em andamento por empresa (409). Busca sem sinal de vida por 5 minutos vira erro com estorno. A tela Descobrir mostra o progresso e retoma ao voltar.
  - Limite: `after()` roda dentro do prazo da rota (`maxDuration` = 120 s). Se um dia as fontes demorarem mais, passar para uma fila (ex.: tabela + worker).
  - Ainda NÃO existe: landing page pública, configuração de deploy na Vercel (precisa de DATABASE_URL do Neon, NEON_AUTH_BASE_URL e NEON_AUTH_COOKIE_SECRET; o banco local PGlite não funciona na Vercel) e busca de pessoas/LinkedIn por busca na web (item 3 proposto).

