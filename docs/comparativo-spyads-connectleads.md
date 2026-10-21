# Comparativo: SPYADS (Contatos de marketing) x ConnectLeads

Fontes: dossiê "SPYADS — Contatos de marketing" (21/10/2026), que descreve o módulo de contatos de um segundo produto, e a especificação do ConnectLeads (vídeo, site e áudio). Usado só como referência funcional. Não copiar código nem textos do SPYADS, e não guardar neste repositório dados de contas de terceiros.

## Em uma frase
Os dois resolvem o mesmo problema: transformar "quem anuncia em rádio" em "com quem falar". O SPYADS é forte em como entrega os contatos (pool, cota, prévia grátis, busca assíncrona). O ConnectLeads é mais amplo em como descobre empresas (4 entradas) e em como cobra (créditos que não expiram).

## O que é igual
| Tema | Nos dois |
|---|---|
| Gatilho | Anúncio detectado em emissora de rádio |
| Contato | Nome, cargo, e-mail, telefone e LinkedIn por pessoa |
| Agrupamento | Contatos organizados por empresa anunciante |
| Revelação | E-mail e telefone podem consumir uso (cota ou crédito) |
| Persistência | O que já foi trazido fica na conta |
| Multi-organização | Cada cliente tem sua conta e seus dados separados |

## Onde diferem
| Tema | SPYADS | ConnectLeads | Sugestão para o Conecta-B2B |
|---|---|---|---|
| Porta de entrada | Só pelos spots detectados nas rádios da conta | 4 entradas: empresas B2B, negócios locais, decisores por site, radar | Manter as 4 entradas do ConnectLeads; o radar alimenta as demais |
| Cobrança | Cota mensal do plano (ex.: 1.000 contatos/mês); novo contato gasta cota e depois é "seu para sempre" | Créditos pré-pagos que não expiram; 1 crédito por busca ou revelação; estorno automático em falha | Créditos que não expiram (mais simples de vender), com extrato e estorno |
| Antes de pagar | Prévia grátis (organizações e cargos, sem e-mail/telefone) e contagem do "pool" disponível por empresa | Resultados mostram só o primeiro nome; pagar para revelar | Adotar a contagem de disponíveis e a prévia grátis do SPYADS |
| Lote | Máximo de 7 contatos novos por desbloqueio, com chave de idempotência | Revelação item a item | Adotar o teto por desbloqueio e a idempotência |
| Busca | Tarefa assíncrona (~1 min) com 4 passos de progresso, "fechar e deixar rodando", trava de busca em andamento (409) e atualização periódica | Não observado | Adotar |
| Empresa sem resultado | Sugere a controladora (grupo) e pede confirmação humana | Não observado | Adotar |
| Cargo | Categorias: CMO, Diretor, Gerente, Coordenador, Analista, Outro | Tabela de senioridade + 7 departamentos | Usar as duas dimensões: senioridade e departamento |
| Pós-busca | CRM completo: Contas, Contatos, Negócios, Relatórios, Inbox, Tarefas, Prioridades, Copilot; pontuação comercial com "Recalcular" | Listas (ponteiros, sem duplicar) e exportação CSV para CRMs externos | Primeira versão: listas + CSV. CRM e pontuação ficam para depois |
| Equipe | Agência como tenant | Organização com Administrador e Membro, painel /admin da operadora | Manter o modelo do ConnectLeads |
| Segurança | Sessão por cookie, CSRF (double-submit), idempotência, trava de concorrência | Não observado | Adotar |
| LGPD | Proposta de base legal, origem e confiança por contato, opt-out, auditoria | Legítimo interesse, só contato profissional | Juntar: legítimo interesse + origem e confiança por contato + opt-out + auditoria |

## Modelo de dados unificado (proposta)
- `organizacao`, `usuario` (papel Administrador ou Membro).
- `anunciante` (com `controladora_id`), `spot` (anúncio detectado: emissora, data, conteúdo transcrito).
- `empresa`, `contato` (cargo, senioridade, departamento, origem, confiança, validado) e `contato_email`, `contato_telefone`.
- `pool_contato`: o que o provedor conhece e ainda não foi desbloqueado por aquela organização.
- `lista`, `lista_item` (ponteiros).
- `credito_extrato` (operação, valor, estorno), `busca_lock`, `idempotencia`.

## Fluxo de busca de contatos (junção dos dois)
1. Usuário escolhe a empresa e vê a contagem de contatos disponíveis (grátis).
2. Prévia grátis: organizações e cargos, sem e-mail nem telefone.
3. Usuário marca as pessoas (até 7) e confirma; gasta créditos.
4. Tarefa assíncrona com progresso; trava impede busca duplicada.
5. Falha ou campo não encontrado: estorno automático no extrato.
6. Sem resultado: sugerir controladora e pedir confirmação.
7. Contatos entram na lista; exportação CSV.

## Pendências levantadas pela comparação
- De onde virão os contatos (o dossiê diz que o servidor do SPYADS não é visível; só o front-end foi lido).
- De onde vêm os spots detectados e como serão transcritos.
- Se o Conecta-B2B terá CRM próprio ou só listas e exportação.
