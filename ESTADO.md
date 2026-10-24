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
  - Próximos passos grátis: descobrir o site pela razão social/nome fantasia (ex.: campo para o usuário informar o site; busca em fonte permitida), verificação de domínio por MX, base aberta de CNPJ baixada para busca por CNAE/cidade (Descobrir sem consulta unitária). Vagas de emprego e licitações estão FORA do escopo (decisão do Igor em 24/10/2026).
  - Pendente que exige o Igor: papel de banco limitado (precisa gerar senha nova e trocar a DATABASE_URL; não apliquei no Neon sozinho), confirmação do opt-out por e-mail (precisa de serviço de envio), login real no Neon Auth, lista dos 50 CNPJs.

- 23/10/2026: pool compartilhado e busca em segundo plano (82 testes, typecheck, lint e build ok; fluxo testado por HTTP em modo demonstração).
  - Migração `0003_pool_e_buscas.sql` (em `supabase/migrations` e `db/neon`): tabelas `pool_busca` (resultado da varredura por empresa, fontes e cargos; compartilhado entre organizações; validade de 30 dias com resultado e 1 dia sem; sem política de leitura) e `busca_job` (busca em andamento por organização). APLICAR NO NEON antes de usar o app contra ele.
  - O pool é chaveado também pelo conjunto de fontes: trocar ou acrescentar uma fonte (ex.: um provedor pago) gera varredura nova. Falha total das fontes não entra no pool. Opt-out remove a pessoa do pool.
  - Cada organização continua pagando o próprio crédito ao trazer os contatos; o pool só evita repetir a varredura. Prévia grátis: `GET /api/decisores/disponiveis?cnpj=`.
  - Busca em segundo plano: `POST /api/decisores/busca` (cobra e responde na hora; o trabalho roda em `after()` do Next), `GET /api/decisores/busca/{id}` (andamento por etapa) e `GET /api/decisores/busca?cnpj=` (retoma a última busca em 24 h). Uma busca em andamento por empresa (409). Busca sem sinal de vida por 5 minutos vira erro com estorno. A tela Descobrir mostra o progresso e retoma ao voltar.
  - Limite: `after()` roda dentro do prazo da rota (`maxDuration` = 120 s). Se um dia as fontes demorarem mais, passar para uma fila (ex.: tabela + worker).
  - Ainda NÃO existe: landing page pública, configuração de deploy na Vercel (precisa de DATABASE_URL do Neon, NEON_AUTH_BASE_URL e NEON_AUTH_COOKIE_SECRET; o banco local PGlite não funciona na Vercel) e busca de pessoas/LinkedIn por busca na web (item 3 proposto).


- 23/10/2026 (tarde): "faz tudo" do Igor. Aplicativo completo, publicado e com material comercial (93 testes, typecheck, lint e build ok).
  - NO AR: https://conecta-b2b.vercel.app (projeto Vercel `conecta-b2b`, equipe igorcross-8951s-projects, ligado ao GitHub igorcross-irc/Conecta-B2B; cada push na `main` publica). Público (sem proteção SSO). Variáveis na Vercel (production e preview): DATABASE_URL (sensível), NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET (sensível), CONECTA_CREDITOS_INICIAIS=5. Sem CONECTA_MODO_DEMO.
  - NEON: migrações 0003 e 0004 aplicadas. Testado no Neon real: `garantir_organizacao` cria organização, membro administrador e 5 créditos; excluir a organização em cascata funciona (dados de teste removidos).
  - Migração 0004: operadora, convites (token secreto, 7 dias), proteção do último administrador, recarga de créditos (só operadora), renomear organização, base comum (`base_empresa_info`, `base_contato`), auditoria.
  - Telas: site público `(site)`: landing `/`, `/entrar` (aceita `?novo=1` e `?proximo=`), `/optout`, `/privacidade` (texto de trabalho, PRECISA de revisão jurídica), `/convite/[token]`. Aplicativo `(app)`: Descobrir (com buscas recentes e `?cnpj=`), Base comum (`/base`, ficha `/base/[cnpj]` com correção de site/nota/tags e adição de contato), Listas, Importar (com opção de compartilhar na base comum), Créditos, Equipe, Configurações (renomear, custos, auditoria), Plataforma `/admin` (só operadora: resumo, organizações, recarga, custos). Menu lateral com troca de organização.
  - Marca: logo e ícone em `public/logo.svg`, `public/logo-icone.svg`, `src/app/icon.svg`, componente `src/components/Logo.tsx`; paleta e classes no `src/app/globals.css` (Tailwind 4: classes de componente não podem ser usadas com @apply entre si).
  - Next 16 com Cache Components: todo acesso a dados de requisição precisa ficar dentro de `<Suspense>` (há um no layout raiz); páginas dinâmicas chamam `await connection()`; não usar `new Date()` em página estática.
  - Apresentação comercial (10 slides): artefato Slides https://claude.ai/artifact/K9oRarR2wLbT48rBvvLqNi (privado até o Igor compartilhar). Preços estão como [__]: decisão comercial pendente.
  - AÇÃO DO IGOR: (1) criar a conta em https://conecta-b2b.vercel.app/entrar?novo=1; (2) me dizer o e-mail para virar operadora (SQL: `insert into operadora select id from neon_auth."user" where email='...'`); (3) testar o fluxo e rodar `npx tsx scripts/testar-provedores.ts docs/modelo-cnpjs.csv` na máquina dele para validar os formatos reais de BrasilAPI/CNPJá/sites; (4) revisão jurídica da página de privacidade.
  - Pendentes: papel de banco limitado (hoje o app conecta como dono do banco e ignora RLS); confirmação do opt-out por e-mail; envio de e-mail dos convites (hoje por link); descoberta de pessoas/LinkedIn por busca na web; verificação de e-mail por MX; PNCP/IBGE; login real não verificado no Neon Auth (não testado de ponta a ponta).

## 23/10 (tarde, parte 2) — site como alvo, pesquisa avançada, IA e Receita

- **Bug corrigido:** `garantirDemo` só roda sem `NEON_AUTH_BASE_URL` (antes criava usuário/org/20 créditos de demo no Neon de produção; dados apagados).
- **Busca por site:** `SiteEmpresa.descobrirCnpjs`, `resolverSite`, `associarSite`, `/api/empresa?site=`.
- **Alvo = CNPJ ou site** (migração `0005_alvo_e_receita.sql`, já aplicada no Neon): chave `site:dominio.com.br` aceita em empresa_cache, contato, pool_busca, busca_job, base_*. Helpers em `src/lib/cnpj.ts` (`normalizarAlvo`, `chaveAlvo`, `alvoValido`, `normalizarBusca`). Em Descobrir, digitar um site pesquisa direto pelo site; botão "Procurar o CNPJ deste site" é opcional.
- **Pesquisa avançada:** página `/pesquisar` + `servicos.pesquisar()` (nome, outros termos, UF, cidade, bairro, segmento/CNAE, filiais) sobre `rf_estabelecimento`/`rf_cnae` + sites conhecidos. Sem a base da Receita carregada, a página avisa.
- **Base da Receita:** `scripts/importar-receita.ts` e workflow `.github/workflows/importar-receita.yml` (Actions → "Importar Receita", inputs ufs/mes/filiais). **Pendente (Igor):** criar o secret `DATABASE_URL` no GitHub (connection string do Neon) e disparar. **Fonte:** o servidor da Receita (dadosabertos.rfb.gov.br) não responde (timeout no GitHub e no PC do Igor; o oficial parece ter migrado para arquivos.receitafederal.gov.br). O importador agora lê o espelho público em Parquet do CNPJ Aberto no Hugging Face (`cnpjaberto/cnpj-dados-receita-brasil-AAAA-MM`, estabelecimentos 3,3 GB / 73,8 mi linhas) via DuckDB, filtrando por UF na fonte (`src/lib/receita/parquet.ts`, testado com Parquet local; acesso real ao Hugging Face NÃO verificado). Roda no GitHub Actions (repo precisa estar público ou ter minutos de Actions) ou local com `npx tsx scripts/importar-receita.ts --ufs=RJ`. `db/neon/0006_busca_trigram.sql` (pg_trgm) já aplicado.
- **Teste de IA:** `/admin/ia` (só operadora), `src/lib/ia/gemini.ts`; lê `GEMINI_API_KEY` (ou `GOOGLE_API_KEY`), `GEMINI_MODEL` opcional; lista modelos e escolhe flash-lite mais novo.
- **Não verificado (sandbox sem internet):** formatos reais das APIs, download da Receita, resposta real do Gemini.
- **Próximos:** descoberta de pessoas por busca web (Tavily/Serper + Gemini), verificação de e-mail (MX), papel de banco sem owner, e-mails de convite/opt-out.

- **Importação RJ (23/10 noite):** rodou no GitHub Actions a partir do espelho Hugging Face: 2.222.761 matrizes ativas do RJ (~450 B/linha com índices). Os índices trigram foram REMOVIDOS do Neon (db/neon/0006 agora é opcional/comentado) para caber em 1 GB; a pesquisa por nome faz varredura (mais lenta, ok). SP junto não cabe no plano free (precisaria de plano pago). Trocar a senha do Neon (vazou no chat) e atualizar DATABASE_URL na Vercel e no GitHub.

## 23/10 (noite) — ficha enriquecida, pessoas, celular e desempenho

- **Importação RJ concluída:** 2.222.761 estabelecimentos em `rf_estabelecimento` (confirmado no Neon). Pesquisa por nome é varredura: ~5 s por consulta (sem trigram). `pesquisar()` agora faz **uma** consulta (`count(*) over ()`), e a página tem `maxDuration = 60`. Hipótese (não reproduzida) para o erro que o Igor viu: duas varreduras estourando o tempo da Vercel.
- **Ficha da empresa (Descobrir):** situação, matriz/filial, porte, MEI/Simples, natureza jurídica, capital social, abertura e idade, CNAE principal e secundários, endereço com link de mapa, telefones/e-mails cadastrais, site, sócios com data de entrada, atalho "empresas do mesmo segmento". Modelo `Empresa` enriquecido (`versao` 2; cache refeito se versão menor). Fallback de dados pela Receita (`rf_estabelecimento`). Faturamento e funcionários: "em breve" (sem fonte gratuita confiável).
- **Pesquisar:** filtros de setor (24 macro-setores), porte, tempo de abertura, com e-mail, com telefone existem no serviço (`PesquisaFiltros`), mas **ainda não estão na tela** (a tela só tem nome, termos, segmento, UF, cidade, bairro, filiais).
- **Pessoas:** campo "Cargos ou áreas" removido; botão "Buscar pessoas (1 crédito)" busca em todas as fontes e a tela refina por departamento, senioridade, com e-mail/telefone e texto, ordenando por confiança + peso do cargo (`src/lib/cargos.ts`). Fontes: QSA da Receita (`SociosReceita`), páginas do site (`SiteEmpresa`), **Hunter** (`HUNTER_API_KEY`, `providers/hunter.ts`) e **busca web** (`TAVILY_API_KEY` + Gemini, `providers/buscaweb.ts`; não lê LinkedIn direto; o nome precisa aparecer no trecho). `src/lib/pessoas.ts` une a mesma pessoa de fontes diferentes (chave primeiro+último nome, sobe confiança) e infere e-mail pelo padrão da empresa (status "inferido"). **Hunter e Tavily: formatos escritos pela documentação, NÃO verificados com resposta real.** Igor colocou as duas chaves no Vercel (19:48); falta teste real.
- **Alvo só por site:** `executarBusca` tenta achar o CNPJ publicado no site (se houver um único candidato) para trazer os sócios. Antes, site sem CNPJ voltava sempre vazio (jobs de oglobo.com.br e descomplica.com.br, créditos estornados).
- **Desempenho:** região `fra1` (vercel.json), consulta ao banco em 2 idas, `contexto` em cache, tela de carregamento e barra de progresso. Neon free suspende após ~5 min parado (primeira tela lenta).
- **Celular:** `PainelLateral` (barra superior com ☰ + gaveta + atalhos embaixo), campos de 16 px, alvos de toque de 44 px, tabelas com rolagem lateral, classe `.campo` criada. Testado em modo demo a 390 px sem rolagem lateral.
- **Falta / próximos:** menu lateral de filtros estilo ConnectLeads unindo Pesquisar e Descobrir; filtros novos na tela; painel de status das chaves em `/admin/ia`; teste real de Tavily/Hunter/Gemini; verificação de e-mail (MX); papel de banco sem owner; e-mails de convite/opt-out. **Igor:** trocar a senha do Neon (atualizar `DATABASE_URL` na Vercel e no GitHub), depois voltar o repositório para privado (Actions deixa de rodar).
- **Validade do cache (20:45):** empresa (`empresa_cache`) e pool de pessoas passaram de 30 para 90 dias (resultado sem pessoas continua 1 dia). Passado o prazo os dados não são apagados, só reconsultados na próxima busca. Política de privacidade atualizada. **Decisão do Igor:** manter a base do RJ e ir complementando conforme as buscas; próximo passo proposto: importação por recorte sob demanda (UF + nome/segmento) via GitHub Actions e descarte do que não é consultado há muito tempo para ficar abaixo de 1 GB (ainda não feito).

## 24/10/2026 — segurança, CI, IA, avisos, API e exportação (branch `claude/melhorias-seguranca-ci`)

Tudo abaixo está testado (153 testes + 49 sob o papel limitado, typecheck, lint e build ok; telas conferidas em modo demo a 390 px e 1280 px). **Nada disto foi aplicado no Neon nem publicado**: faltam as migrações 0007–0010 e as variáveis de ambiente (ver "Ação do Igor").

- **CI** (`.github/workflows/ci.yml`): typecheck (com `next typegen`), lint, testes, `test:papel` e build em PR e na `main`.
- **SSRF** (`src/lib/httpSeguro.ts`): o IP é validado no momento da conexão (`lookup` do socket), sem janela de DNS rebinding; mais faixas bloqueadas (IPv6 que embute IPv4, 64:ff9b, 6to4, reservados, multicast). Site: páginas em paralelo (3 por vez) com prazo total de 20 s.
- **Limite de abuso no banco** (migração 0007, tabela `limite_pedido`): vale em todos os servidores. Usado no opt-out (5/h por IP), busca por site (30/h por usuário), IA (30/h) e API (600/h por organização).
- **Opt-out com confirmação por e-mail** (Resend; `RESEND_API_KEY`, `EMAIL_REMETENTE`, `APP_URL`). Sem Resend configurado, aplica na hora como antes. Token de uso único, guardado como hash, vale 2 h; a página de confirmação só apaga no clique (leitores de e-mail não consomem o link). Apagamento agora pela função `aplicar_opt_out`.
- **Papel de banco limitado `conecta_app`** (migração 0008, `docs/papel-de-banco.md`): RLS passa a valer. A suíte inteira de serviços roda sob o papel (`npm run test:papel`). **Não verificado contra o Neon real.**
- **Respostas reais** de BrasilAPI e CNPJá guardadas como fixture (`src/lib/providers/fixtures`, o sandbox alcança as duas APIs). Achado e corrigido: a cascata parava na BrasilAPI e nunca trazia o domínio/Simples/MEI da CNPJá; agora continua até achar o domínio. **Ainda não verificados com resposta real:** Hunter, Tavily, Gemini e o espelho Parquet do Hugging Face (precisam de chave ou acesso). 
- **Pesquisar**: filtros de setor, porte, abertura, e-mail/telefone cadastral e ordem na tela; **busca em linguagem natural** (Gemini; filtros validados contra listas fechadas, `src/lib/ia/assistente.ts`).
- **Pesquisas salvas com aviso diário** (migração 0009, cron `0 11 * * *` em `vercel.json`, `CRON_SECRET`): avisa por e-mail das empresas **abertas desde o último aviso**. Depende de a base da Receita ser reimportada; sem importação nova não há empresa nova.
- **Rascunho de abordagem por IA** em cada pessoa (e-mail, WhatsApp, LinkedIn); não usa e-mail nem telefone do contato.
- **Exportação** para HubSpot, RD Station e Pipedrive (CSV com BOM, protegido contra fórmula).
- **API pública somente leitura** (migração 0010, `docs/api.md`): chaves por organização em Configurações; `/api/v1/empresa`, `/api/v1/pesquisar`, `/api/v1/creditos`.
- **Painel de integrações** em `/admin/ia` (mostra quais variáveis existem, nunca o valor). SVGs do template removidos, `.env.example` e README atualizados, trava contra `CONECTA_MODO_DEMO` em produção na Vercel.
- **Ação do Igor:** (1) revisar e fazer merge da branch; (2) aplicar `db/neon/0007` a `0010` no Neon (SQL Editor, como dono); (3) criar a conta no Resend e definir `RESEND_API_KEY`, `EMAIL_REMETENTE`, `APP_URL`, e `CRON_SECRET` na Vercel; (4) trocar a senha do Neon vazada e, só depois, seguir `docs/papel-de-banco.md` para o app usar `conecta_app`; (5) testar com chaves reais: Gemini, Tavily, Hunter.
- **Não feito:** dividir `servicosPg.ts` (1,4 mil linhas, uma fábrica com estado compartilhado: dividir exige redesenho, não é mecânico); índice de busca por nome mais rápido e descarte da base da Receita para caber em 1 GB; pontuação de aderência (ICP); cobrança real por Pix/Stripe (exige conta e chaves); observabilidade (Sentry/logs estruturados).

## 24/10/2026 (noite) — design, pesquisa e fontes novas (branch `claude/melhorias-seguranca-ci`)

170 testes (50 sob o papel limitado), typecheck, lint e build ok. Telas conferidas com Playwright em 390 px (celular), 820 px (tablet) e 1440 px (computador), sem rolagem lateral. **Migrações novas, ainda não aplicadas no Neon: 0011 e 0012** (além de 0007 a 0010 já listadas acima).

- **Design:** componentes novos em `globals.css` (`cartao`, `chip`, `chip-ativo`, `opcao`, `kpi`, `vazio`, `cabecalho-pagina`...), ícones próprios (`src/components/Icones.tsx`), navegação em três desenhos: celular (barra no topo, gaveta, atalhos embaixo com "Mais"), tablet (trilho de ícones) e computador (coluna completa). Landing atualizada e cabeçalho do site arrumado no celular.
- **Pesquisar:** painel de filtros (coluna fixa no computador, folha que sobe no tablet e no celular), aplicação automática ao escolher, chips dos filtros ativos com ×, estado em lista de 27 UFs, **sugestões ao digitar** para cidade (tabela `rf_municipio`, migração 0012; o importador a atualiza) e atividade (CNAE), setores/portes/idade em botões de escolha, atalhos na tela inicial, cartões de resultado, ordenação, páginas numeradas e pesquisas salvas.
- **Descobrir:** ficha em abas (Resumo, Pessoas, Informações extras, Sócios), carrega sozinha ao vir de um link, cartões de pessoas com barra de confiança.
- **Fontes novas** (ver `docs/apis-conectaveis.md`, com o que foi testado): CVM (Diretor de RI como contato e dados de companhia aberta), Wikidata (funcionários, receita), Google Notícias, sanções CEIS/CNEP (precisa de `PORTAL_TRANSPARENCIA_TOKEN`), Minha Receita como segunda fonte da Receita, e checagem gratuita de domínio de e-mail por MX (novo status "domínio recebe e-mail"; trava de segurança se o DNS do ambiente estiver quebrado). Cache em `enriquecimento_cache` (migração 0011).
- **Achado:** o filtro por fornecedor do PNCP é ignorado em silêncio, então não dá para saber que contratos uma empresa ganhou por essa API.
- **Ação do Igor:** aplicar `db/neon/0011` e `0012`; cadastrar a chave grátis do Portal da Transparência (e-mail em portaldatransparencia.gov.br/api-de-dados/cadastrar-email) e definir `PORTAL_TRANSPARENCIA_TOKEN`; rodar de novo o importador (ou `select atualizar_municipios()` no Neon) para as sugestões de cidade.
- **Não feito:** faturamento e funcionários para empresas pequenas (sem fonte aberta), Google Places e verificador de e-mail pago (precisam de chave), telas de Base/Equipe/Admin repaginadas uma a uma (herdam o novo visual, mas não ganharam layout próprio).

## 24/10/2026 (madrugada) — pesquisa em estado fora da base voltava 0

- **Causa:** a tabela `rf_estabelecimento` só tem o RJ (SP não coube no plano grátis do Neon). Pesquisar em SP voltava "0 empresas" sem explicar.
- **Corrigido na tela:** a Pesquisar mostra quais UFs a base cobre; ao filtrar uma UF fora dela, avisa e indica as saídas; digitar um CNPJ de 14 dígitos oferece abrir a ficha direto (funciona para qualquer estado, pelas APIs).
- **Importação por recorte** (`docs/carregar-base.md`): o importador e o workflow "Importar Receita" ganharam `busca` (todas as palavras no nome, na razão social ou no fantasia) e `raizes` (CNPJs-raiz, todos os estabelecimentos, qualquer UF). Testado contra o espelho real do Hugging Face: por CNPJ-raiz ~30 s; por nome em SP ~1 min 20 s. O workflow deixou de montar o comando por texto (entradas por variável de ambiente, sem `eval`).
- **Ação do Igor:** rodar o workflow com `ufs=SP`, `busca=<nome do grupo>`, `filiais=true` (ou `raizes=<raiz1>,<raiz2>`) para trazer as razões da empresa em SP.

## 24/10/2026 (tarde) — monitoramento, telas, e2e, divisão do serviço e migrações no Neon (branch `claude/monitoramento-qualidade-telas`, empilhada no PR #1)

- **Migrações aplicadas no Neon de produção (projeto "Conecta B2B"), 24/10/2026:** 0007 a 0013. Antes, ensaio completo numa transação desfeita contra o banco real (passou: 92 municípios do RJ, papel criado, 26 tabelas), depois a aplicação de verdade. Conferido: 27 tabelas, papel `conecta_app` sem `BYPASSRLS`, 24 políticas, 5 funções, banco em 625 MB, site no ar (200). O app ainda NÃO usa `conecta_app` (falta trocar a `DATABASE_URL`, ver `docs/papel-de-banco.md`). O código novo só vale depois do merge dos PRs; o código antigo segue funcionando com o banco migrado.
- **Vagas e licitações FORA do escopo** (decisão do Igor): removidas dos docs e do roadmap.
- **Monitoramento sem Sentry** (migração 0013): cada chamada a fonte de dados (empresa, pessoas, informações extras, IA, e-mail) grava sucesso, falha e tempo; erros inesperados de rotas e telas vão para `erro_app`; log estruturado em JSON (`src/lib/log.ts`); `/api/saude` para monitor externo (UptimeRobot etc.); Plataforma ganhou abas **Fontes de dados** (semáforo por fonte, p50/p95, últimas falhas) e **Saúde** (banco, base da Receita, erros). 30 dias de histórico, limpeza automática.
- **Telas** de Base comum, Equipe e Plataforma repaginadas (visão geral, fontes, saúde, IA em abas).
- **Testes de ponta a ponta** (Playwright, `npm run test:e2e`, 14 testes em computador e celular) e job `e2e` no CI. Modo demonstração não consulta fontes externas na ficha.
- **`servicosPg.ts` dividido** em 10 grupos (`servicosPg.<grupo>.ts`), tipos (`.tipos`) e auxiliares (`.contexto`), sem mudar comportamento (53 testes de serviços, também sob o papel limitado). Para um grupo chamar outro, o contrato fica em `Cruzados` (tipos explícitos, evita referência circular).
- **Cotação do Neon** em `docs/cotacao-neon.md` (medido: 290 bytes por empresa; Brasil inteiro cabe em ~8 GB; custo estimado US$ 13 a 82 por mês, a computação é o que pesa). **Integração com CRM:** `docs/integracao-crm.md`.

## 24/10/2026 (noite) — CRM por arquivo e perfil de cliente ideal

- **Exportação de empresas da pesquisa** (`/api/pesquisar/exportar`): CSV padrão e formatos de importação do HubSpot, RD Station e Pipedrive, com as mesmas filtragens da tela (até 5.000 por arquivo, 10 por hora por usuário, sem gastar crédito). Exportação de pessoas ganhou a coluna CNPJ. A integração por API fica para depois (`docs/integracao-crm.md`).
- **Perfil de cliente ideal e aderência** (migração 0014, tabela `perfil_ideal`, **aplicada no Neon de produção em 24/10/2026** após ensaio revertido): o administrador marca setores, portes, estados, cidades, idade e exigência de e-mail/telefone em Configurações; a Pesquisar mostra "N% aderente" em cada empresa (com os motivos ao passar o mouse) e ordena por aderência. A nota existe em TypeScript (explica) e em SQL (ordena a pesquisa inteira); um teste confere que as duas dão o mesmo número. Pesos: setor 30, região 25, porte 20, idade 15, contato 10; só conta o que o perfil define.
- **Espaço no Neon:** decisão de ir para ~12 GB (Brasil inteiro, matrizes ≈ 8,5 GB + índice trigrama ≈ 3 GB). A troca de plano é feita pelo Igor no painel do Neon.
- **Aviso de fonte fora do ar** (`/api/cron/fontes`, todo dia 12:00 UTC): se alguma fonte falhar em mais de 30% das chamadas nas últimas 24 h (mínimo 5), manda e-mail à operadora. Precisa de `OPERADORA_EMAIL`, `CRON_SECRET` e Resend configurados.
- **Descobrir no celular:** ao concluir a busca, a tela rola até as pessoas; aba "Informações extras" virou "Extras" para as quatro caberem.
- **Ainda não feito (depende de decisão do Igor):** botão de importação sob demanda (precisa de token do GitHub), importação mensal agendada (definir quais estados).

## 24/10/2026 (noite, parte 2) — Mercado (branch `claude/mercado-visoes`, empilhada na #2)

- **Tela Mercado** (`/mercado`): tamanho e distribuição do recorte escolhido (estado, cidade, setor, porte): total de matrizes ativas, % com e-mail/telefone cadastral, por setor, porte, cidade (15 maiores), estado, idade da empresa e aberturas por ano. Barras em CSS, clique leva à Pesquisa já filtrada. Sem filtro não calcula (varrer a base inteira não ajuda). Os filtros da pesquisa viraram `construirFiltro`, usado por `pesquisar` e `mercado`.
- **Ideias seguintes** (não feitas): empresas parecidas com a lista de clientes, espaço livre contra o CRM, grupos por sócios (precisa da base de sócios), mapa de calor por bairro.

## 24/10/2026 (noite, parte 4) — revisão dura de Descobrir e da ficha (PR #5)

Críticas encontradas e o que foi feito:
- **Sócio que é empresa aparecia como "pessoa"** (holding, fundo, S.A.). Agora fica só na aba Sócios, marcado "Empresa sócia", e não vira card de pessoa.
- **Homônimos eram fundidos** (João Pedro Silva + João Paulo Silva). A união agora exige nomes do meio compatíveis (`mesmaPessoa`).
- **Origem era texto técnico** ("BrasilAPI — QSA + Site x (página pública)"). Virou etiquetas ("Sócio na Receita Federal", "Publicado no site", "Citado em x.com", "Base comum", "E-mail adivinhado") com explicação (`src/lib/origem.ts`).
- **Confiança era um % sem explicação.** Agora é Alta/Média/Baixa com "por quê?".
- **E-mail adivinhado só era identificado depois de pagar para revelar.** Agora o status aparece antes do botão ("palpite, pode não existir").
- **Custos escondidos:** botões mostram o custo (e-mail, telefone, busca) com o valor da organização.
- **Não ficava claro de quem era cada pessoa:** cabeçalho "Pessoas ligadas a {empresa} · CNPJ"; os dados da Receita foram renomeados "Endereço e contato cadastrados na Receita" com aviso de que costumam ser da contabilidade.
- **CNPJ cortado no celular**, nomes em MAIÚSCULAS, nome fantasia vazio, filtros ocupando a primeira tela, botão "Salvar todos" que salvava pessoas escondidas pelo filtro, respostas atrasadas de uma empresa anterior sobrescrevendo a nova, abas sem teclado.
- **Testes duros:** 39 de unidade (tabela de homônimos, invariante aleatório com 200 rodadas, sócios PJ, origens, e-mails inferidos) e 5 e2e novos (desktop e celular).
- **Não resolvido (decisão de produto):** a busca reaproveita contatos antigos mas cobra o mesmo crédito; a "base comum" mostra contatos trazidos por outros clientes (agora identificada, mas vale revisar a política de LGPD); contatos antigos guardados em MAIÚSCULAS só são formatados na exibição.
