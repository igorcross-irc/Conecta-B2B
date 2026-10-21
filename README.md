# Conecta-B2B

Sistema de prospecção B2B inspirado no ConnectLeads (Connectmix, lead.connectmix.com): sistema B2B para apoiar áreas de vendas: descobre empresas e decisores, cruza com sinais de compra e entrega contatos verificados, cobrado por créditos. Personalizável por cliente (tenant); rádio é só um dos tipos de sinal possíveis.

Projeto pessoal de Igor Cruz, independente de qualquer empresa ou do trabalho dele. A inspiração vem de material de demonstração do ConnectLeads que foi compartilhado e de informações públicas do site. Trabalho feito em conversas com o Claude, no projeto "Leads".

## Onde está cada coisa

- `ESTADO.md`: ponto de partida de qualquer conversa nova. O que foi feito, o que falta e as decisões em aberto.
- `docs/visao-produto.md`: direção do produto (sistema B2B geral, personalizável por tenant).
- `docs/especificacao-funcional.md`: especificação das telas, regras, créditos e modelo de dados sugerido.
- `docs/transcricao-video.txt`: transcrição automática (Whisper) do vídeo de demonstração. Pode ter erros de nomes próprios.

## Como continuar em outra conversa

Peça ao Claude para ler `ESTADO.md` e a memória do projeto "Leads" antes de começar, e para atualizar o `ESTADO.md` ao fim de cada etapa.

## Rodar o projeto

Requisitos: Node 22 ou mais novo.

```bash
npm install
CONECTA_MODO_DEMO=1 npm run dev   # modo demonstração: empresa e decisores fictícios, funciona sem internet
npm run dev                       # empresa real pela API aberta da CNPJá; decisores ainda fictícios
npm test                          # testes da lógica e da migração SQL
npm run build
```

Abra http://localhost:3000. Telas: Descobrir (busca por CNPJ, decisores, revelação paga), Listas (com exportação CSV) e Créditos (saldo e extrato).

## O que já funciona
- Consulta de empresa por CNPJ (API aberta da CNPJá), com validação dos dígitos verificadores.
- Busca de decisores em cascata de provedores, com opt-out, sem repetir contatos e com origem e data em cada dado.
- Créditos: cobrança idempotente, estorno automático quando a busca volta vazia, dado inexistente não cobra.
- E-mail e telefone ocultos até a revelação; listas por referência; CSV só com o que foi revelado, protegido contra fórmula de planilha.
- Esquema do banco (Supabase/Postgres) com segurança por linha, funções de cobrança e revelação, testado em Postgres embutido.

## O que ainda é provisório
- O estado da aplicação fica em memória e há uma só organização de demonstração. Falta ligar ao Supabase (autenticação, organizações, papéis).
- Os decisores vêm de um provedor de demonstração. Falta integrar provedores reais (ver `docs/custos-e-roteiro-de-teste.md`).
- Sem login, painel da operadora, importação, sinais de compra nem configuração por tenant (esquema SQL já prevê).
