# Estado do projeto

Atualizado em 21/10/2026.

## Objetivo
Criar um sistema igual ao ConnectLeads. Projeto independente: não tem relação com o trabalho do Igor nem com empresa dele. A inspiração vem de um vídeo de demonstração que foi compartilhado e de informação pública do site lead.connectmix.com. Referências: o site, o vídeo e o levantamento do site (arquivo no projeto "Leads" do Claude).

## Feito
- Especificação funcional do app logado, a partir de 120 quadros do vídeo.
- Levantamento da landing, telas de acesso, rotas, FAQ e dados legais (projeto "Leads"), consolidado na especificação.
- Transcrição do áudio do vídeo (docs/transcricao-video.txt).
- Stack provável identificada: SPA React, Lovable, Supabase.

- Comparativo com o módulo "Contatos de marketing" do SPYADS (docs/comparativo-spyads-connectleads.md), usado só como referência funcional.

## Falta
- Navegar pelas telas internas que o vídeo não mostra: Importações, Equipe, Configurações, /admin e modais. Exige sessão nova do Claude ou modo de permissão manual.
- Escolher stack e começar o código.

## Decisões em aberto
1. Landing promete busca por raio e avaliações do Google Maps, CNPJ/QSA e 7 departamentos de decisores; o app do vídeo mostra bem menos. O que construir?
2. Preços: landing diz "sob consulta", app mostra R$ 0,60 a R$ 0,78 por crédito.
3. Bounce de e-mail: "0%" na tabela comparativa e "abaixo de 2%" no FAQ. Não replicar a inconsistência.
4. E-mail pessoal no perfil do contato (dito no vídeo) versus LGPD só com contato profissional (dito no site).
5. Adotar do SPYADS: contagem de contatos disponíveis, prévia grátis, teto de 7 por desbloqueio, busca assíncrona com progresso, controladora com confirmação. Confirmar com o Igor.
6. Radar de Concorrência: a origem dos dados de rádio (captura e transcrição de anúncios) é desconhecida. Definir fonte própria ou parceria.

## Observação sobre a especificação
O parágrafo de abertura de docs/especificacao-funcional.md ainda diz que o site não pôde ser lido. Está desatualizado: as seções finais incorporam o levantamento do site e o áudio.
