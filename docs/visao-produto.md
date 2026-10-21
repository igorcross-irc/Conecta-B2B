# Visão do produto (definida em 21/10/2026)

## Direção
O Conecta-B2B é um sistema B2B para apoiar as áreas de vendas de qualquer empresa. Não fica restrito a rádios nem a veículos de comunicação. Cada cliente (tenant) pode personalizar o sistema para o seu segmento.

ConnectLeads e SPYADS ficam como referências funcionais, não como molde de segmento. O que eles fazem com anúncios de rádio vira um caso particular de algo mais geral: um sinal de compra.

## Núcleo (igual para todos os tenants)
- Descoberta de empresas e de decisores, por filtros (setor, porte, localização, cargo, senioridade, departamento).
- Ficha da empresa e do contato, com e-mail e telefone verificados e revelação paga.
- Listas, exportação CSV e importação.
- Créditos pré-pagos, extrato e estorno automático.
- Organização com usuários e papéis, painel da operadora.
- Segurança e LGPD (origem e confiança por contato, opt-out, auditoria).

## Personalizável por tenant (proposta)
| O que muda | Exemplo |
|---|---|
| Sinais de compra (gatilhos) | Mídia: anúncios em rádio. Outros segmentos: vaga aberta, expansão, nova filial, licitação, notícia, mudança de cargo, uso de determinada tecnologia |
| Módulos ativos | Radar de sinais, negócios locais, decisores, listas, CRM leve |
| Campos e nomenclatura | Rótulos próprios (conta, praça, território) e campos personalizados na empresa e no contato |
| Perfil de cliente ideal e pontuação | Regras de pontuação de lead por tenant |
| Cargos e departamentos alvo | Pré-seleção de cargos conforme a área de vendas |
| Fontes de dados | Quais provedores consultar e em que ordem (cascata) |
| Créditos e planos | Pacotes, preços e limites por tenant |
| Marca | Logo, cores, domínio |

## O que muda no desenho
1. **Radar de Concorrência deixa de ser o centro.** Vira o módulo "Mídia e rádio", um dos provedores de sinal. A tabela de anúncios detectados é substituída por uma tabela genérica de sinais, com tipo, fonte, empresa, data e conteúdo.
2. **Configuração por tenant** passa a ser parte do modelo de dados desde o início (tabela de configuração e de campos personalizados).
3. **Fonte de sinais vira plugável.** Cada tipo de sinal tem seu coletor. Adiar a decisão de captura de rádio sem travar o resto.
4. **Primeira versão enxuta.** Núcleo completo, com um ou dois tipos de sinal, em vez de todos.

## Perguntas em aberto
- Primeiro público: qual segmento de cliente será o primeiro tenant e quais sinais ele precisa?
- Quem opera: autoatendimento (cliente cria a própria conta) ou operado por vocês (conta criada no painel, como no ConnectLeads)?
- Quais sinais entram na primeira versão, além de rádio?
- Quanto de personalização é configuração pelo cliente e quanto é trabalho de vocês por tenant?
