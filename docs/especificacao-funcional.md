# ConnectLeads: especificação funcional para replicar o sistema

2026-10-21 · Igor Cruz

O ConnectLeads (Connectmix) é uma plataforma de prospecção B2B que cruza anúncios detectados em rádios com enriquecimento de empresas e decisores, cobrada por créditos. Esta especificação vem do vídeo de 8 minutos (120 quadros revisados); o site não pôde ser lido automaticamente, então as telas públicas além da home ficam como lacuna.

## Visão geral

O produto vende um atalho: em vez de prospecção fria, o time aborda empresas que acabaram de anunciar em rádio (orçamento ativo comprovado) já com o contato direto de sócios e diretores.

**Proposta (texto da home):** "Conecte sua equipe aos decisores de empresas que estão anunciando agora." Selo: "Inteligência de Mídia & Radar de Concorrência B2B".

**Fluxo em 3 etapas:**

- **Gatilho**: anúncio detectado numa emissora (ex.: campanha institucional, nº de veiculações no mês).
- **Qualificação**: dados enriquecidos da empresa (faturamento estimado, equipe, segmento).
- **Contato direto**: sócio ou diretor com WhatsApp e e-mail verificados.

**Dois eixos de dado que não se misturam:** o *sinal de rádio* (anúncios auditados nas emissoras) e a *base de leads* (empresas e contatos vindos de busca, importação ou enriquecimento). A tela de Descobrir diz explícito: "O sinal de rádio continua separado destes leads".

**Mapa de telas (app logado, sidebar escura):**

| Rota | Tela | Função |
|---|---|---|
| /dashboard | Dashboard | Indicadores da base e do radar |
| /descobrir | Descobrir | Busca em 4 modalidades (gasta créditos) |
| /empresas | Base Leads › Empresas | Lista, enriquece e detalha empresas |
| /contatos | Base Leads › Contatos | Lista e revela e-mail/telefone |
| /listas | Base Leads › Listas | Pastas de trabalho para exportar ao CRM |
| /creditos | Créditos | Saldo, extrato e recarga |

**Elementos fixos do layout:** logo Connectmix + "ConnectLeads" no topo da sidebar; saldo de créditos no canto superior direito de toda tela; rodapé da sidebar com avatar e nome do usuário, organização (Connectmix), ícone de engrenagem (configurações), alternador de tema claro/escuro e botão de sair; sidebar recolhível. As rotas inferidas acima seguem o que a barra de status mostrou (/empresas, /dashboard).

## Landing page pública

Tema escuro, fonte geométrica sem serifa (parece Poppins), botão primário azul, botão verde "Meu Painel", acentos rosa-magenta da marca.

- **Header:** logo + "ConnectLeads"; links Como Funciona, Recursos, Planos, FAQ; botão verde "Meu Painel" (vai ao app).
- **Hero:** selo, título grande, parágrafo ("radar de concorrência em tempo real" em negrito, cita auditoria de emissoras ao vivo e acesso a WhatsApp e e-mail corporativo de sócios e diretores). CTAs: "Começar a prospectar" (azul, primário) e "Ver Radar de Concorrência ao vivo" (contorno).
- **Quatro checks abaixo dos CTAs:** radar de concorrência em emissoras de rádio; empresas com verba ativa e comprovada no ar; contatos validados de sócios e diretores; exportação compatível com seu CRM.
- **"Visão prática da plataforma"** (selo "Radar ao Vivo · 24/7"): três cartões lado a lado. Etapa 01 Gatilho (emissora, praça, anúncio no ar, veiculações no mês); Etapa 02 Qualificação (faturamento estimado, equipe, segmento); Etapa 03 Contato direto (foto, nome, cargo, telefone mascarado com etiqueta WhatsApp, e-mail truncado, "Verificado").
- **Radar demonstrativo:** título "Selecione uma emissora concorrente para visualizar os anunciantes ativos"; chips de emissoras (Jovem Pan FM, BandNews FM, Nativa FM, Alvorada FM) e lista de anunciantes com: nome, inserções por mês, tipo de campanha (ex.: institucional, comercial, lançamento imobiliário), segmento, faturamento estimado, localização, decisor identificado com cargo, "WhatsApp Validado" com número mascarado e botão "Ver Detalhes do Lead". Rodapé: "Auditoria em tempo real sobre a malha de radiodifusão Connectmix em todo o Brasil" e link "Consultar pacotes de créditos".
- **Faixa final:** "Pronto para auditar as emissoras líderes da sua praça?" + botão "Consultar Planos e Condições".

Os anunciantes e decisores dessa demonstração são exemplos ilustrativos (dados de vitrine), não dados reais. Existem também uma tela de abertura (logo animado centralizado em fundo azul-marinho) e, no menu, as seções Como Funciona, Recursos, Planos e FAQ, que não apareceram no vídeo.

### Seções da home lidas no site (altém do vídeo)

A ordem de rolagem é: hero, Visão prática, Radar de Concorrência (3 passos + demonstração), Motor de Segmentação B2B, Enriquecimento Duplo & Profundo, Gargalos da Prospecção Outbound, Comparativo de Soluções, Condições Comerciais (âncora #planos), Perguntas Frequentes e CTA final. A demonstração usa a âncora #radar-radios. No celular o menu vira botão "Abrir menu".

- **Radar de Concorrência, 3 passos:** (01) ativar o radar na emissora concorrente da praça; (02) enriquecer dados corporativos (razão social, CNPJ ativo, faturamento presumido, porte, quadro de sócios/QSA); (03) acessar o decisor direto (e-mail corporativo verificado e WhatsApp de proprietários, diretores e heads de marketing). Tese: empresa que anuncia em rádio concorrente já tem verba aprovada.
- **Motor de Segmentação B2B (as 4 abas):** busca por palavra-chave ou domínio; **27 macro-setores** (Agronegócio, Indústria & Manufatura, Logística & Transporte, Varejo, Atacado & Distribuição, Automotivo, Alimentos & Bebidas, Saúde & Diagnósticos, Farmacêutico, Educação, Serviços Financeiros, Imobiliário & Construção, TI & Software, Mídia & Comunicação, Marketing & Publicidade, Energia & Solar, Hotelaria & Turismo, Moda, Serviços Profissionais, Cooperativas e outros) e **mais de 100 atividades** (ex. supermercados e atacadistas, concessionárias, hospitais e clínicas, transportadoras, construtoras, escolas e universidades, provedores de internet). **Faixas de funcionários:** 1-10, 11-50, 51-200, 201-1.000 e 1.000+. Faixas de faturamento anual em reais, filtro por UF e município, e filtro "empresas ativas em radiodifusão".
- **Enriquecimento de empresas:** CNPJ e situação cadastral (bases da Receita), faturamento estimado e porte, QSA, CNAE principal e secundários com regime tributário, histórico de radiodifusão e garantia de não duplicidade. **Enriquecimento de decisores:** e-mail corporativo com validação SMTP, telefone e WhatsApp, senioridade e departamento, LinkedIn, revelação em lote e validação ativa. Listas por nicho ou campanha com exportação CSV (com razão social e domínio por contato) para HubSpot, Pipedrive e RD Station.
- **Gargalos (3 blocos problema → solução):** filtro de secretárias (solução: WhatsApp e e-mail direto de sócios), contas sem capacidade de investimento (faturamento estimado e filtro de empresas ativas em mídia) e timing desconectado (abordagem pelo histórico de veiculação). Destaque: "reduzem o ciclo médio de fechamento em até 40%".
- **Comparativo (tabela de 3 colunas: ConnectLeads × plataformas globais × listas públicas/Receita):** auditoria de rádios ao vivo e radar de anunciantes (só o ConnectLeads, "Exclusivo"), WhatsApp direto dos decisores, e-mail com validação SMTP ("0% bounce"), QSA e faturamento, pesquisa por domínio (ABM), taxonomia em português e contratação flexível por créditos, sem fidelidade.
- **Condições Comerciais:** três cartões, todos com preço "Sob Consulta" e botão "Consultar Valores no WhatsApp": Starter (500 créditos; testes e validação de carteira), Growth (1.500; selo "Mais Escolhido"; lote, SMTP em tempo real, WhatsApp de diretores, ABM, suporte prioritário) e Scale (5.000; selo "Maior Eficiência"; melhores condições por volume, enriquecimento massivo, suporte dedicado, indicado para emissoras e prospecção em massa). Nota: "Créditos acumulativos", sem expiração. Os preços em reais só aparecem dentro do app (modal de recarga).
- **FAQ (8 perguntas, acordeão):** o que é o ConnectLeads e como se diferencia; como funciona o Radar; o que são créditos e como são consumidos; se perde crédito quando e-mail ou telefone não é localizado (o app confirma que há estorno automático); como é garantida a validade dos e-mails; se dá para adicionar membros à mesma conta e saldo; como exportar para CRM ou discador; conformidade com a LGPD. Só a primeira resposta estava aberta, as demais ficam como lacuna.

Observação: o site cita uma mistura de dados com CNPJ e QSA da Receita, mas os painéis vistos no app trazem campos de um provedor internacional de enriquecimento. Vale confirmar quais fontes realmente alimentam cada campo.

## Dashboard

Cartões clicáveis: cada um leva à lista já filtrada (ex.: "Empresas ainda não localizadas" abre /empresas?vinculo=not_searched). Valores abaixo são os da conta do vídeo, úteis como formato de referência.

| Bloco | Indicador (valor no vídeo) |
|---|---|
| Linha 1 | Empresas (223) · Leads prontos (9, "4% das empresas") · Contatos (99) · Com e-mail (10, "10% dos contatos") · Com telefone (3, "3% dos contatos") |
| Linha 2 | Empresas prontas para enriquecer (4) · Empresas ainda não localizadas (197) · Contatos sem e-mail (89) |
| Atividade recente | Importações (3) · Empresas enriquecidas (15) · Contatos encontrados (99) |
| Inteligência de rádio · Radar | Empresas observadas (207) · Aparições (3.833) · Emissoras (1) · Média por empresa (18,5) · Cidades (1) · Segmentos ativos (65) · Multi-emissora (0) · Prontos para abordar (5) · Dias no ar (30) |
| Rankings | "Emissoras com mais anunciantes" (barra horizontal, ex.: Regional · Florianópolis-SC, 207) e "Segmentos mais presentes" (top 5 com contagem e %, ex.: varejo 39, 44%) |

"Lead pronto" parece ser a empresa que já tem enriquecimento e ao menos um contato com e-mail; "Prontos para abordar" (radar) é o equivalente no lado do rádio. A definição exata não aparece no vídeo e precisa ser confirmada.

## Descobrir (Motor de Busca & Prospecção B2B)

Cabeçalho fixo: ícone + "Motor de Busca & Prospecção B2B" + descrição das quatro modalidades. Abaixo, quatro abas numeradas. Cada aba tem painel de filtros à esquerda, resultados à direita e estado vazio ("Monte os filtros e clique em buscar"). Toda busca mostra spinner no botão e na área de resultados.

| Aba | Filtros | Resultado | Custo observado |
|---|---|---|---|
| 1. Empresas & Contas B2B | Setor (multi-seleção com chips, ex. Marketing / Publicidade); Atividade (multi-seleção com busca e grupos, ex. "Tecnologia & mídia": agência de marketing, assessoria de imprensa, jornal/editora, operadora de telefonia, produtora de vídeo, provedor de internet); Localização (texto livre, ex. "Brazil, São Paulo" ou "Brasília"); Porte em funcionários (select, ex. 51–200); Faturamento mín. e máx. (US$) | Tabela com checkbox, Empresa (+ ícones LinkedIn, Twitter, Facebook), Domínio, Telefone, Fundação, Local; rodapé "27 resultado(s)" e paginação | 1 crédito por página buscada (operação Org Enrich: "Descoberta de empresas — página 1") |
| 2. Negócios Locais & Praças | Segmento (texto, ex. oficina mecânica); Cidade; Estado (UF). Texto de apoio: complementa negócios regionais que o motor principal não indexa; opção "Completar dados locais" busca telefone, site, endereço e categoria; "pode levar alguns segundos por empresa, é uma busca ao vivo, uma de cada vez" | Lista selecionável; ao adicionar, a empresa entra na base com selo "Busca local" e botão "Dado local" | 1 crédito (operação Motor Leads: "Busca local: Supermercado em Tapira/MG") |
| 3. Decisores & C-Levels | Site da empresa (domínio; aceita URL completa e normaliza); Cargo (multi-seleção); Senioridade (select, padrão "Qualquer senioridade"); Departamento (select, "Qualquer área"); Localização da pessoa | Tabela: checkbox, Nome (só o primeiro nome), Cargo, Empresa, Sinais (ícones de e-mail e telefone disponíveis; verde = disponível, laranja = parcial); "13.773 resultado(s) · Página 1 de 551" (25 por página) | 1 crédito por página (People Search: "Descoberta de contatos — página 1"); e-mail e telefone só aparecem ao "Revelar" |
| 4. Radar de Concorrência | Estado (select); Cidade (select dependente, desativado até escolher o estado); "Ou busque pelo nome" da emissora | Catálogo de milhares de emissoras, só carregado depois de escolher praça ou nome: Emissora, Frequência (selo "102.9 FM", "1060 AM"), Cidade/UF; painel direito "N selecionada(s)" com cidades/estados, remoção individual e botão verde "Solicitar Cotação no WhatsApp" | Sem débito de crédito; fluxo comercial: escolher praça → marcar emissoras concorrentes → pedir cotação; entrega em até 48h numa lista exclusiva |

**Comportamentos comuns:** selecionar linhas e adicioná-las à base grava a origem como "busca" e **nunca duplica** o que já existe; o saldo no topo cai na hora (999.944 → 999.943 → 999.942...). Os botões de busca ficam rosa (primário) antes da primeira consulta e viram cinza-contorno depois.

## Base Leads: Empresas, Contatos e Listas

### Empresas

Barra superior: busca ("Buscar empresa..."), Filtros, Exportar, Importar, botão rosa "+ Nova empresa". Tabela com checkbox e seletor de colunas; 20 por página (configurável); "223 empresa(s) · Página 1 de 12".

- **Colunas:** Empresa (com selo "Busca local" quando vem da aba 2), Segmento (rótulos como varejo, automotivo, alimentação/restaurante, turismo/entretenimento, construção/serviços), Rádios (ícone + nº de emissoras), Aparições (ordenação padrão decrescente), Contatos (número) e ação: botão "Enriquecer" (empresa ainda sem dados), selo "Dado local" (empresa da busca local) ou vazio (já enriquecida); lixeira para excluir.
- **Painel lateral da empresa** (abre ao clicar na linha): nome editável (lápis), segmento, selo "Enriquecida", botão "Reenriquecer"; chips das listas em que está (removíveis) e "Adicionar à lista"; descrição longa (veio em inglês do provedor); cartão **Presença em rádio** (nº de emissoras, aparições, confiança em % com rótulo "Alta", e por emissora: tipo "Regional", praça, aparições, resumo da campanha gerado por IA com promoção, período, slogan e classificação como "Oferecimento"); cartão **Dados da empresa** (data de enriquecimento, domínio com link "trocar" para corrigir o match, site, LinkedIn, indústria, localização, funcionários, faturamento estimado, telefone corporativo, ticker, Twitter, Facebook, Crunchbase, grupo econômico); **Tecnologias** (127 chips, "Ver mais/menos"); **Palavras-chave** (162, "Ver todas"); **Dados brutos (JSON)** recolhível; **Variações identificadas** (como o nome apareceu nos anúncios, base do casamento anúncio → empresa); **Contatos (N)** com "Buscar mais".
- **Linha de contato dentro da empresa:** nome, selo de senioridade (manager, director), ícone LinkedIn, cargo · departamento (ex. master_marketing, master_finance), e "Sem e-mail" ou botão "Revelar" para e-mail e para telefone; depois de revelado mostra os dados na linha.

### Contatos

Busca por nome ou cargo, filtro por Empresa, Filtros, Exportar. Colunas: Nome, Cargo, Empresa (link para o painel da empresa), Senioridade, E-mail ("Revelar" ou "Sem e-mail"), Telefone ("Revelar"), lixeira. 20 por página.

**Painel do contato:** avatar, nome, selo de senioridade, selo rosa "Telefone revelado", empresa, cargo, bio, LinkedIn; listas (inclui "Via empresa: <lista>" quando herdada); bloco Contato com e-mails (rótulos principal, profissional, pessoal; botão copiar) e telefones (copiar); bloco "Outros dados recebidos" (catchall do domínio e veredito, Match Confidence, "Revealed For Current Team", Show Intent); bloco "Origem & enriquecimento".

### Listas

Banner azul "Como funcionam as Listas de Prospecção" (selo "0 créditos consumidos"): pastas de trabalho para separar lotes antes de importar para o CRM (HubSpot, Pipedrive, RD Station, Ploomes). Regras ditas na tela: **sem duplicidade** (listas guardam só ponteiros), **seguro** (remover de uma lista ou excluí-la nunca apaga da base geral) e **exportação pronta** (planilhas separadas de empresas e contatos, com nome e domínio da empresa em cada contato).

- **Visão geral:** botão azul "Nova Lista"; três totais (listas, empresas agrupadas, contatos agrupados); busca por nome ou descrição; cartões com faixa de cor, nome, descrição, nº de empresas e contatos, data de criação, menu ⋮ e "Acessar".
- **Detalhe da lista:** "Voltar para todas as listas", título com cor, Editar, Excluir lista; abas Empresas (4) e Contatos (30); "Exportar Contatos (Todos)"; filtro interno; "Adicionar contatos"; "Sincronizar contatos das empresas" (traz para a lista os contatos das empresas dela). Cada contato mostra a origem do vínculo: "Busca empresa" ou "Busca contato".

## Créditos

Três cartões no topo: **Saldo disponível** (número grande + "créditos"), **Plano contratado** (ex. "Avulso", com créditos consumidos e descrição: pacotes avulsos, sem cobrança ou mensalidade fixa) e **Modalidade de cobrança** ("Sob Demanda", créditos recarregáveis, selo ACTIVE). Botão verde "Comprar créditos".

**Extrato detalhado de transações** (filtros: período, usuário, busca; 20 por página): Data e hora, Usuário, Operação (selo), Descrição, Valor (seta vermelha para débito, verde para crédito) e Saldo restante.

| Operação (selo) | Valor | Quando ocorre |
|---|---|---|
| Org Enrich | -1 | Descoberta de empresas (aba 1) e enriquecimento de empresa |
| Motor Leads | -1 | Busca local (aba 2) |
| People Search | -1 | Descoberta de contatos (aba 3) |
| Email Reveal | -1 | Revelação de e-mail de um contato (custo da revelação de telefone não aparece no vídeo) |
| Refund | +1 | Estorno automático: "e-mail não encontrado" ou "falha ao enriquecer empresa" |

**Recarga (modal "Recarregar Créditos de Prospecção"):** três pacotes e pagamento manual por PIX.

| Pacote | Créditos | Preço | Por crédito | Selo |
|---|---|---|---|---|
| Starter | 500 | R$ 390,00 | R$ 0,78 |  |
| Growth | 1.500 | R$ 1.050,00 | R$ 0,70 | Mais Popular |
| Scale | 5.000 | R$ 3.000,00 | R$ 0,60 | Maior Economia |

O modal mostra a chave PIX (CNPJ da empresa favorecida) com botão "Copiar Chave" e o botão verde "Enviar Comprovante via WhatsApp"; a equipe credita em até 15 minutos. Ou seja, **não há gateway de pagamento automático**: a liberação é manual por um administrador. Preços e pacotes acima são os da Connectmix, usados só como referência. O saldo da conta no vídeo (cerca de 999.940) é de teste ou interno.

## Modelo de dados e regras (sugestão)

Esta seção é **dedução** a partir das telas, não algo visto no vídeo.

| Entidade | Campos principais |
|---|---|
| Organização (tenant) | nome, saldo de créditos, plano, modalidade de cobrança |
| Usuário | nome, avatar, organização, papel (admin libera créditos) |
| Empresa | nome, domínio, segmento, origem (busca, local, importação, rádio), status de enriquecimento, dados do provedor (site, LinkedIn, indústria, funcionários, faturamento, tecnologias, palavras-chave, JSON bruto), nomes alternativos |
| Contato | nome, cargo, senioridade, departamento, empresa, e-mails (com rótulo), telefones, LinkedIn, flags de revelação, origem |
| Emissora | nome, frequência, banda (FM/AM), cidade, UF, tipo (regional) |
| Presença em rádio | empresa × emissora: nº de aparições, confiança %, resumo da campanha, classificação, período |
| Lista e item de lista | nome, cor, descrição; item = ponteiro para empresa ou contato + origem do vínculo |
| Transação de crédito | data, usuário, operação, descrição, valor (+/-), saldo após |
| Pedido de cotação | organização, emissoras selecionadas, status, prazo de 48h |
| Importação | arquivo, linhas, usuário, data (o dashboard conta importações) |

**Regras de negócio que o vídeo evidencia:**

- Débito de crédito e gravação da transação acontecem juntos; falha do provedor gera estorno automático (+1) com motivo.
- Adicionar resultado de busca à base deduplica (por domínio para empresas; por pessoa/empresa para contatos).
- Revelar e-mail/telefone cobra uma vez por contato e organização ("Revealed For Current Team"); depois fica visível sem novo custo.
- Listas guardam ponteiros; excluir lista ou tirar item não apaga empresa ou contato.
- Radar e base de leads são fontes separadas; a empresa do radar vira lead ao ser enriquecida e casada por domínio, com "trocar domínio" para correção manual.
- Radar de concorrência na aba 4 não é autoatendimento: gera pedido de cotação por WhatsApp.

**Provedores externos prováveis (inferidos pelos campos e pelo estilo):** um provedor de enriquecimento B2B estilo Apollo (campos de senioridade, departamento tipo "master_finance", catchall, match confidence, tecnologias em massa); uma busca de negócios locais estilo Google Places (aba 2, "uma busca ao vivo por empresa"); e um pipeline próprio de captura e transcrição de áudio de rádio com IA para gerar as "aparições" e os resumos de campanha. Esse último é o diferencial e não aparece no vídeo.

**Stack sugerida:** front-end React com sidebar e painéis laterais (drawers), Postgres com autenticação e RLS por organização, funções de servidor para chamar os provedores e debitar créditos de forma atômica, fila para enriquecimento em lote.

**Cuidado legal:** a base contém e-mail e telefone de pessoas físicas, inclusive e-mail pessoal. Para operar no Brasil, defina base legal na LGPD, canal de opt-out e política de retenção antes de lançar.

## Lacunas e próximos passos

**O que não deu para extrair:**

- O site lead.connectmix.com bloqueou a leitura automática (robots.txt), então só vi a home pelo vídeo. A home foi lida depois pela aba aberta no navegador (está na seção da landing page); o FAQ completo e as telas de acesso vieram do levantamento do projeto (ver a seção final).
- O áudio do vídeo (narração) não foi transcrito: a ferramenta local não pôde baixar o modelo e não enviei o áudio a serviço externo sem sua autorização.
- Não apareceram os modais de Filtros, Exportar, Importar, Nova empresa e Nova lista, a tela de configurações (engrenagem), o fluxo de cotação por WhatsApp (texto da mensagem) e o modo claro/escuro em uso.
- Custo da revelação de telefone e do botão Enriquecer não foram vistos (só a revelação de e-mail, 1 crédito). Os "leads prontos" e os números do radar precisam de definição confirmada.
- A parte invisível e mais valiosa: como os anúncios são capturados nas emissoras, transcritos e ligados a empresas. Isso exige decisão de fonte e infraestrutura, não só tela.

**Sugestão de ordem de construção:**

- Base: autenticação por organização, créditos com extrato e estorno, layout com sidebar.
- Empresas, Contatos e Listas (CRUD, importação, exportação, painéis de detalhe).
- Descobrir abas 1 a 3 ligadas aos provedores de enriquecimento e busca local.
- Radar: catálogo de emissoras, tabela de aparições e cotação por WhatsApp; depois a captura automática.
- Dashboard e landing page por último, com identidade visual própria.

**Para fechar as lacunas, preciso de uma destas:** acesso ao sistema logado pelo navegador que você conectar, ou prints/vídeos das telas que faltam; e sua decisão sobre usar o áudio do vídeo (posso transcrevê-lo se você autorizar um serviço externo).

## Consolidação: vídeo + levantamento do site (projeto Leads)

O arquivo "ConnectLeads_levantamento" do projeto cobre o lado público (landing, login, código do front-end); o vídeo cobre o app logado. Juntos fecham a maior parte do sistema. O que segue são só os pontos novos ou que corrigem o texto acima.

**Rotas confirmadas pelo código do front-end** (todas redirecionam ao login sem sessão):

| Rota | Observação |
|---|---|
| /dashboard, /descobrir, /empresas, /contatos, /listas, /creditos | Batem com as telas do vídeo |
| /empresas/:id, /listas/:id | Ficha da empresa e detalhe da lista como páginas, além dos painéis laterais |
| /importacoes, /importacoes/empresas | Tela de importação (o botão Importar do vídeo leva a ela) |
| /equipe | Membros da organização, com papéis Administrador e Membro |
| /configuracoes-conta | A engrenagem do rodapé da sidebar |
| /admin, /admin/clientes, /admin/creditos, /admin/consumo, /admin/usuarios, /admin/configuracoes | Painel da operadora; é onde os créditos são liberados manualmente após o PIX |
| /login, /admin/login, /redefinir-senha | Acesso (abaixo) |

**Telas de acesso:** /login com e-mail, senha com ícone de visualizar, "Lembrar meu acesso neste dispositivo" (marcado por padrão), botão rosa "Entrar na Plataforma" e "Esqueci minha senha". /admin/login ("Acesso restrito") no mesmo formato, com "Manter conectado neste dispositivo". /redefinir-senha com "Nova senha", "Repita a nova senha", mensagens "Senha muito curta", "As senhas não conferem", "Senha atualizada!" e, sem token, "Este link expirou ou já foi usado". Rotas internas mostram uma tela de carregamento com o logo antes de redirecionar. Não há cadastro público: a entrada é por convite ou por criação no painel admin.

**Regras confirmadas pelo FAQ (texto completo no levantamento):**

- **Equipe:** multiusuário com Administrador e Membro; o administrador convida SDRs, closers e gestores, que criam listas conjuntas e compartilham o mesmo saldo.
- **Crédito só se houver entrega:** o site diz que não debita quando e-mail ou telefone não é localizado. No app isso aparece como débito seguido de estorno (+1) no extrato, então o efeito final é o mesmo.
- **E-mail:** handshake SMTP em tempo real antes de entregar, bounce "abaixo de 2%" (a tabela comparativa diz "0% bounce"; copy inconsistente, não replicar).
- **Exportação CSV:** colunas Razão Social, Nome Fantasia, CNPJ, Domínio, Nome do Decisor, Cargo, E-mail corporativo e WhatsApp; destinos citados: HubSpot, Pipedrive, RD Station, Ploomes, Salesforce e disparadores.
- **LGPD:** o site fundamenta no legítimo interesse B2B (Lei 13.709/2018, art. 7º IX e art. 10), só contato profissional e cadastros públicos. Os links Termos de Uso, Política de Privacidade e Segurança não abrem nada; no seu sistema, publique esses textos.
- **Radar:** "tecnologia proprietária de monitoramento em tempo real" que audita milhares de emissoras. O mecanismo continua desconhecido.

**Onde a promessa da landing difere do app visto no vídeo** (decida o que realmente construir):

| Tema | Landing | App no vídeo |
|---|---|---|
| Negócios locais | Busca por raio em km, avaliações do Google Maps | Campos Segmento, Cidade e Estado; sem raio nem avaliação visíveis |
| Dados da empresa | CNPJ, situação cadastral, QSA, CNAE, regime tributário | Painéis com site, LinkedIn, indústria, funcionários, faturamento, tecnologias; CNPJ e QSA não apareceram |
| Decisores | 7 departamentos (Vendas, Marketing, Mídia, Financeiro, Operações, TI, RH); contagem indexada por senioridade (ex. +520 mil gerentes/heads de operações, +410 mil C-level) | Filtros de cargo, senioridade e departamento; resultados com primeiro nome e revelação paga |
| Radar | Demonstração interativa com 4 emissoras e 3 anunciantes cada, selo "Verba Ativa" | Catálogo de emissoras e pedido de cotação por WhatsApp; os anúncios chegam pela equipe em até 48h |
| Preços | "Sob consulta" | R$ 0,60 a R$ 0,78 por crédito no modal de recarga |

**Tecnologia confirmada:** SPA em React, com referências a Lovable e backend Supabase. Isso casa com a stack sugerida acima e permite construir o clone na mesma base. O robots.txt marca o site como "aplicação interna e privada" e o sitemap lista outro domínio da empresa (radio.connectmix.com, biblioteca de edições), um produto irmão que pode ser a origem dos dados de rádio.

**Transcrição do áudio:** feita com Whisper rodando localmente (modelo small, português). É automática: nomes próprios e termos podem ter erro (ex.: "bitubis" = B2B). Resumo na seção seguinte.

## O que o áudio do vídeo acrescenta

Narração de Felipe Rosa, diretor da ConnectMix, apresentando a ferramenta a um cliente em potencial (cerca de 8 minutos). Só os pontos novos ou que confirmam regras do produto:

- **Posicionamento:** ferramenta de "prospecção e enriquecimento de dados"; o painel mostra "como funciona a coleta de dados".
- **Empresas & Contas B2B:** setor, atividade, localização e porte; busca geral, independente de a empresa atuar com rádio ou TV. Exemplo: marketing em Brasília com mais de 50 funcionários retorna cerca de 20 a 25 empresas por busca, e é possível trazer mais.
- **Negócios Locais:** exemplo de supermercados em Tapira (MG), para mostrar que pequenas praças funcionam.
- **Decisores:** informa-se o site da empresa (exemplos: globo.com, agência África). O sistema vem pré-configurado para nível intermediário a sênior, com cargos estratégicos para marketing e mídia (diretor de criatividade, diretor-geral de mídia etc.), cada um com e-mail e telefone.
- **Radar de Concorrência:** escolhe-se estado e cidade, vê-se as emissoras rastreadas (exemplo: Belo Horizonte) e clica-se em "solicitar cotação personalizada". A equipe então traz as empresas anunciantes para dentro da plataforma. Dá para contratar uma praça inteira ou várias.
- **Exemplo do radar:** Atacadão anunciando na Rádio Regional de Florianópolis, com 193 aparições em julho. A ficha traz logo, resumo do conteúdo do anúncio (campanha de fim de mês, foco em ofertas e preços baixos, menção a loja física, app e site, período 27 a 31 de julho, slogan), além de site, LinkedIn, endereço, faturamento, ano de fundação e tecnologias.
- **Contatos:** por empresa (ex.: gerente de marketing) com e-mail e telefone; os demais ficam atrás de "revelar e-mail" e "revelar telefone". O perfil da pessoa traz foto e dados do LinkedIn, e-mail profissional e pessoal e telefone.
- **Fontes:** "mais de 30 plataformas" para enriquecer os dados (LinkedIn é uma delas).
- **Listas:** criadas por praça (praça A, B, C etc.), com empresas e contatos dentro de cada uma.
- **Regras comerciais:** sem limite de usuários (todos os usuários da empresa cliente podem usar a mesma plataforma); créditos contratados dentro da plataforma, **não expiram**, com recarga mensal, semestral ou anual à escolha.
- **Fecho:** convite para reunião estratégica sobre enriquecer os dados de quem toca no concorrente e a base de contatos do time comercial.

Observação: a fala diz que o contato pessoal (e-mail pessoal) pode vir no perfil, o que não aparece na copy de LGPD do site (só contato profissional); vale decidir isso no seu sistema.
