# Custos das fontes (pago, gratuito, IA) e roteiro de teste

Pesquisa de 21/10/2026. Preços vêm de páginas dos fornecedores ou de blogs comparativos e mudam. Os valores por contato abaixo são contas feitas aqui a partir desses preços, e não promessas de custo real.

## 1. O que é gratuito, pago ou feito com IA

### Gratuito (custa só o nosso trabalho)
| Fonte | O que dá | Limites |
|---|---|---|
| Base aberta de CNPJ (Receita Federal) | Empresa, CNAE, porte, endereço, telefone e e-mail cadastrados, sócios com CPF mascarado | Publicada todo mês. [Uma base completa tem cerca de 73 milhões de estabelecimentos, 37 arquivos zip e cerca de 8 GB compactados (27 GB em CSV)](https://www.tabnews.com.br/jeffev/transformei-a-base-aberta-do-cnpj-73-milhoes-de-estabelecimentos-em-buscas-de-segundos-sem-servidor-e-sem-banco-de-dados). O texto tem problemas de codificação. Contatos muitas vezes são da contabilidade |
| APIs de consulta de CNPJ com token grátis | Mesmos dados, por consulta, mais logo e site | [Limite de uso no plano grátis](https://docs.cnpj-api.com/en/introducao); para volume, usar a base baixada |
| Site da própria empresa | Páginas "contato", "sobre" e "equipe" | Exige coleta própria; dado defasado; respeitar termos do site |
| Planos grátis de provedores | Hunter 50 créditos/mês (só e-mail), Apollo grátis, People Data Labs 100 créditos/mês (dados ofuscados) | Servem para teste, não para operação |

### Pago
| Fonte | Custo |
|---|---|
| Provedores de contatos (Apollo, Lusha, RocketReach, People Data Labs, FullEnrich, Cognism, ZoomInfo) | Ver tabela de preços em `docs/fontes-de-dados.md`. Cognism e ZoomInfo sem preço público |
| Google Places (telefone e site de negócios locais) | [Segundo um blog do setor](https://openplacesapi.com/blog/google-places-api-pricing): Text Search Pro US$ 32 por 1.000 chamadas, Enterprise US$ 35 e Enterprise com Atmosphere US$ 40; franquia grátis mensal por SKU (10 mil, 5 mil e 1 mil chamadas). O custo segue o campo mais caro pedido. Confirmar no Google antes de decidir |
| Verificação de e-mail | Não pesquisado; só citado como etapa necessária |

### Com IA (custo variável, taxa de acerto desconhecida)
Fluxo: um modelo de linguagem lê o site da empresa e outras páginas públicas (equipe, sobre, notícias), extrai nomes, cargos e canais para um formato fixo (schema) e propõe candidatos. Segundo [um guia de coleta](https://scrapegraphai.com/blog/lead-generation-scraping), é preciso validar e-mails, atualizar com frequência e focar em contato profissional. O guia não traz taxa de acerto nem preço.
- Pontos fortes: cobre empresas pequenas e locais que os provedores não têm, e resume o que a empresa faz.
- Pontos fracos: o modelo pode errar cargo, nome ou e-mail. E-mail inferido por padrão (nome.sobrenome@dominio) só vale se for verificado. Coleta automática pode ser bloqueada e depende dos termos de cada site.
- Regra: dado vindo de IA entra com selo "inferido", origem registrada, e só vira "verificado" depois de checagem.

## 2. Conta aproximada por contato (e-mail + celular)
Preços de [comparativo do FullEnrich](https://fullenrich.com/content/enrichment-api-tools), setembro de 2026. Contas feitas aqui.
| Provedor | Créditos por contato com e-mail e celular | Preço do crédito (plano de entrada) | Custo aproximado |
|---|---|---|---|
| FullEnrich | 1 + 10 = 11 | US$ 29 por 500 créditos, cerca de US$ 0,058 | cerca de US$ 0,64 |
| Lusha | 1 + 5 = 6 | US$ 49,90 por 400 créditos, cerca de US$ 0,125 | cerca de US$ 0,75 |
| Apollo | 1 + 8 = 9 | Não dá para calcular: o plano cobra por assento e o texto não informa o número de créditos | Sem estimativa |

Contas sem desconto por volume e sem contar buscas sem resultado, que alguns provedores cobram (Lusha cobra no mínimo 1 crédito por requisição). O custo real por contato útil depende da taxa de acerto, e é isso que o teste mede.

## 3. Roteiro do teste de provedores

**Objetivo:** descobrir qual combinação entrega mais contatos úteis de empresas brasileiras pelo menor custo.

**Amostra:** 50 empresas brasileiras, escolhidas por você.
- 10 grandes, 20 médias e 20 pequenas.
- Pelo menos 5 setores e 3 regiões.
- Incluir 5 empresas onde você já conhece um decisor, para servir de gabarito.

**Alvo por empresa:** até 3 decisores (por exemplo, diretor comercial, diretor de marketing, diretor geral), com e-mail corporativo, celular e URL do LinkedIn.

**Etapas**
1. Preparar a planilha da amostra: nome, site, CNPJ, porte, setor, cidade.
2. Rodar cada provedor nos planos grátis ou de entrada, na mesma amostra. Candidatos: Apollo, People Data Labs, FullEnrich, mais uma rodada com IA sobre o site.
3. Verificar os e-mails retornados com um verificador (sintaxe, domínio e caixa) e checar o tipo de telefone. Não enviar e-mail frio nesta fase.
4. Conferir à mão uma amostra de 20 contatos: a pessoa existe, o cargo está certo, trabalha mesmo na empresa.
5. Preencher a tabela de resultados.

**Métricas por provedor**
| Métrica | Como medir |
|---|---|
| Cobertura de empresas | % das 50 empresas com pelo menos 1 decisor |
| Cobertura de contato | % dos contatos com e-mail e com celular |
| E-mail válido | % dos e-mails aprovados na verificação |
| Acerto de cargo e pessoa | % certos na conferência manual de 20 |
| Custo por contato útil | gasto total ÷ contatos com e-mail válido e cargo certo |
| Tempo de resposta | segundos por consulta |
| Origem registrada | o provedor informa de onde veio e quando foi atualizado |
| Verificação de e-mail | o provedor já verifica antes de entregar |

**Como decidir**
- Se um provedor sozinho passar de 60% de cobertura de contato com e-mail válido, ele vira a primeira etapa da cascata.
- Combinar 2 ou 3 provedores em cascata se isso elevar a cobertura de modo que compense o custo extra.
- A IA entra na cascata como última etapa, para empresas sem resultado nos provedores, com selo "inferido".
- Descartar provedor com cobrança por busca vazia se a taxa de acerto for baixa.

**Orçamento do teste:** começar só com planos grátis. Se faltar crédito, um mês de plano de entrada de dois provedores (por exemplo, FullEnrich e Lusha) fica na casa de US$ 80 pelos preços acima.

## 4. Pendências
- Você escolher as 50 empresas (ou me dar o segmento para eu sugerir uma lista).
- Escolher um verificador de e-mail.
- Confirmar preços atuais de cada provedor no site oficial antes de pagar.
