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

## Falta
- Navegar pelas telas internas que o vídeo não mostra: Importações, Equipe, Configurações, /admin e modais. Exige sessão nova do Claude ou modo de permissão manual.
- Executar o teste de provedores (roteiro em docs/custos-e-roteiro-de-teste.md): falta definir as 50 empresas e o verificador de e-mail. Baixar a base aberta de CNPJ (ver docs/fontes-de-dados.md).
- Validar base legal e opt-out com advogado.
- Escolher stack e começar o código.

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
