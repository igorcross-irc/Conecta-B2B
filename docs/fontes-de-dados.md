# Fontes de dados para contatos e empresas

Pesquisa de 21/10/2026. Objetivo: um executivo de vendas busca uma empresa e obtém contatos profissionais (e-mail, telefone, redes sociais) e dados que ajudem a abordar a pessoa certa. Quase todo texto vem do próprio fornecedor ou de blogs com interesse comercial: preços e taxas de acerto são indicativos e precisam de teste com listas reais.

## 1. Camadas de dado
| Camada | O que entrega | Fontes possíveis |
|---|---|---|
| Empresa (Brasil) | Razão social, fantasia, situação cadastral, porte, CNAE, capital social, endereço, telefone e e-mail cadastrados, Simples/MEI, quadro societário | Dados abertos da Receita Federal, APIs de CNPJ |
| Empresa (sinais) | Notícias, tecnologias usadas, site e logo | Notícias, site da empresa, APIs de CNPJ com logo e site |
| Pessoa (profissional) | Nome, cargo, senioridade, departamento, e-mail corporativo, celular, URL do LinkedIn | Provedores de enriquecimento por API |
| Verificação | Validade do e-mail (sintaxe, domínio, caixa), tipo de telefone | Verificadores e cascata de provedores |

## 2. Fontes públicas brasileiras
- **Base aberta de CNPJ da Receita Federal.** [Segundo o TabNews](https://www.tabnews.com.br/antoniorincon/prospeccao-b2b-com-dados-publicos-de-cnpj-achar-enriquecer), toda lista de prospecção vendida nasce dela. Tem sócios com CPF mascarado e faixa etária.
  - Limites: telefone e e-mail cadastrados muitas vezes são da contabilidade; a situação cadastral demora semanas para refletir mudanças; consultas em massa por API são lentas, e para volume o melhor é baixar a base completa.
- **APIs de consulta de CNPJ.** Exemplo: [CNPJ-API](https://docs.cnpj-api.com/en/introducao) (Receita Federal, Simples Nacional, logos e sites; tokens gratuitos com limite). Existem outras (BrasilAPI, ReceitaWS, CNPJá); os preços não foram verificados.
- **Sinais complementares:** notícias e empresas recém-abertas. Vagas de emprego e licitações ficaram fora do escopo (decisão de 24/10/2026: o produto é prospecção B2B de empresas, não busca de vagas).

## 3. Provedores de contatos com API
Fonte: [comparativo do FullEnrich](https://fullenrich.com/content/enrichment-api-tools) (de um fornecedor concorrente, preços de set/2026).

| Provedor | Entrega | Preço e regras |
|---|---|---|
| People Data Labs | Registros de pessoas (e-mail, telefone, endereço), cerca de 3 bilhões de perfis | Grátis com 100 créditos/mês (dados ofuscados); Pro a partir de US$ 98/mês |
| Apollo | E-mail, celular, demografia, empresa; 240M+ contatos | Grátis; Basic US$ 49 por assento; e-mail 1 crédito, celular 8 |
| Lusha | E-mail (1 crédito), telefone (5) | Starter US$ 49,90/mês (400 créditos); cobra mínimo mesmo sem resultado |
| Cognism | Foco em dados B2B europeus | Sem preço público |
| ZoomInfo | 500M+ profissionais, 50+ sinais de compra | Sob cotação; sem cobrança em "no match" |
| Hunter | Só e-mail | Grátis com 50 créditos/mês |
| RocketReach | E-mail e telefone | Essentials US$ 33/mês; reembolsa busca sem dado verificado |
| FullEnrich (cascata) | E-mail de trabalho, pessoal, celular | 1 crédito por e-mail de trabalho, 3 por pessoal, 10 por celular; erro não cobra; cobertura média de e-mails ~80% (dado do fornecedor) |
| Clay | Orquestra 200+ provedores | Grátis com limite; Launch US$ 167/mês |

Para o mercado brasileiro a cobertura dos provedores internacionais é incerta (o artigo diz 60% a 95% conforme região). Testar com uma lista real de empresas brasileiras antes de escolher.

## 4. LinkedIn: o ponto de maior risco
- A [Proxycurl](https://www.unipile.com/proxycurl-alternative/) (API de perfis do LinkedIn) fechou em 4 de julho de 2025, depois de ser processada pelo LinkedIn em janeiro de 2025. O termo de uso do LinkedIn proíbe coleta automatizada, e a empresa o aplica contratualmente.
- Consequência para o projeto: não montar nossa própria base raspando perfis. Usar a URL do LinkedIn como informação vinda de provedores, ou como dado que o próprio usuário cola. A alternativa citada (cada usuário conectar a própria conta) é de um fornecedor com interesse comercial e não cobre perfis fora da rede do usuário.

## 5. Privacidade (LGPD) e limites do que coletar
Os pontos abaixo vêm de blogs, não de texto jurídico. Antes de lançar, validar com advogado e consultar a ANPD.
- Base legal usual: legítimo interesse, com identificação clara de quem contata e opt-out. Contato público não dispensa isso ([TabNews](https://www.tabnews.com.br/antoniorincon/prospeccao-b2b-com-dados-publicos-de-cnpj-achar-enriquecer)).
- Dados da base de CNPJ são de pessoa jurídica; não usar para perfilar pessoas físicas. Cuidado com MEIs (abordagem pode parecer golpe).
- O [Agendor](https://www.agendor.com.br/blog/mailing-b2b/) cita multa de até 2% do faturamento, limitada a R$ 50 milhões, e desaconselha comprar listas prontas.
- Recomendação de escopo: coletar só dado profissional (nome, cargo, e-mail e telefone corporativos, perfil profissional). Não coletar CPF, endereço residencial, redes sociais pessoais, familiares nem dados sensíveis. Guardar origem, data e nível de confiança de cada dado, e manter lista de opt-out que bloqueia novos contatos.

## 6. Arquitetura sugerida de busca
1. Usuário informa empresa (nome, site ou CNPJ).
2. Resolve a empresa e traz dados cadastrais da base de CNPJ (grátis).
3. Lista decisores por cargo, senioridade e departamento a partir de provedores.
4. Revela e-mail e telefone em cascata: base própria, depois provedor A, B, C, verificando o e-mail antes de entregar; crédito só com resultado verificado.
5. Registra origem, data, confiança e base legal do contato; respeita opt-out.

## 7. Próximos passos
- Testar 2 ou 3 provedores (Apollo, People Data Labs, FullEnrich) com 50 empresas brasileiras e medir taxa de acerto e custo por contato útil.
- Baixar a base aberta de CNPJ e medir o que cobre.
- Definir o texto de base legal e o fluxo de opt-out com advogado.

## 8. Endereços para cadastro e download (21/10/2026)
Provedores de contatos (sites oficiais; confirmar planos e limites do plano grátis em cada um):
- Apollo: https://www.apollo.io (documentação: https://docs.apollo.io)
- People Data Labs: https://www.peopledatalabs.com (painel: https://support.peopledatalabs.com/hc/en-us/articles/30096408039195-API-Dashboard-Quickstart)
- FullEnrich: https://fullenrich.com (documentação: https://docs.fullenrich.com)
- Lusha: https://www.lusha.com
- Hunter: https://hunter.io
- RocketReach: https://rocketreach.co

Base de CNPJ e APIs:
- Base completa da Receita Federal, publicada todo mês: https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/ (arquivos em subpastas AAAA-MM). Página do conjunto de dados: https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj. O endereço de download já mudou antes, então se não abrir, procurar pela página do conjunto de dados.
- CNPJá, API aberta: `GET https://open.cnpja.com/office/{cnpj}` (CNPJ sem pontuação). Sem cadastro, 5 consultas por minuto por IP; traz dados da Receita, Simples/MEI, SUFRAMA, contatos, CNAEs e sócios; garante atualização em até 45 dias para ativos. Documentação: https://cnpja.com/api/open
- CNPJ-API: https://docs.cnpj-api.com/en/introducao (token grátis com limite)
- BrasilAPI e ReceitaWS: existem, mas não consegui ler os termos e limites (a BrasilAPI bloqueia leitura automatizada).

Cuidados no cadastro: ler os termos de uso comercial de cada plano grátis antes de usar em produto; não colocar chaves de API no repositório nem no chat.
