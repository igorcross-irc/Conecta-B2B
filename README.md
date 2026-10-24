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
O estado completo e atualizado está em `ESTADO.md`. Em resumo:
- Busca de empresa por CNPJ ou site (BrasilAPI e CNPJá), ficha enriquecida e pesquisa avançada sobre a base da Receita (RJ), com filtros de setor, porte e tempo de abertura.
- Busca de pessoas em cascata (QSA da Receita, site da empresa, Hunter, busca web), com opt-out, sem repetir contatos e com origem e data em cada dado.
- Créditos com cobrança idempotente e estorno automático; e-mail e telefone ocultos até a revelação; listas e CSV protegido contra fórmula de planilha.
- Login (Neon Auth), organizações, equipe e convites, painel da operadora, base comum, importação de CSV.
- Opt-out público com confirmação por e-mail (Resend) e limite de pedidos contado no banco.
- Papel de banco limitado `conecta_app`, para a segurança por linha valer de verdade (`docs/papel-de-banco.md`).

## Testes e CI
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:papel` (serviços sob o papel limitado) e `npm run build`. O GitHub Actions
roda tudo em PR e na `main` (`.github/workflows/ci.yml`). Depois de clonar rode `npx next typegen` antes do typecheck.

## Variáveis de ambiente
Veja `.env.example`. Sem `DATABASE_URL` o app usa um Postgres local embutido; sem `NEON_AUTH_BASE_URL` roda em modo demonstração.
