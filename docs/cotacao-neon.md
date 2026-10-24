# Cotação do Neon para ter a base de todos os estados

Preços lidos em neon.com/pricing em 24/10/2026, em dólar (multiplique pelo câmbio do dia). Confira a página antes de contratar.

## Números do plano pago (Launch)

| Item | Valor |
|---|---|
| Mínimo mensal | Nenhum: paga só o que usa |
| Armazenamento | US$ 0,35 por GB por mês |
| Computação | US$ 0,106 por CU-hora (1 CU é cerca de 4 GB de RAM). Não há horas incluídas, ao contrário do plano grátis (100 CU-horas) |
| Suspensão por inatividade | 5 minutos, e pode ser desligada |
| Recuperação pontual (restore) | Até 7 dias, US$ 0,20 por GB por mês sobre o que é guardado |
| Tráfego público | 500 GB incluídos |
| Ramificações (branches) | 10 incluídas |

O plano Scale cobra US$ 0,222 por CU-hora (mais que o dobro) e só compensa com muitas ramificações ou 30 dias de restore.

## Quanto espaço a base ocupa (medido no seu banco)

- O RJ ocupa **290 bytes por empresa** (2.222.761 empresas = 614 MB, já com os índices).
- Matrizes ativas, medido na base da Receita de outubro/2026: **Brasil 27,05 milhões**, SP 8,37 milhões, MG 2,82 milhões.
- A estimativa anterior que passei (cerca de 12 GB) estava alta: com esse tamanho por linha o país inteiro cabe em **cerca de 8 GB**.

| Cenário | Dados | Armazenamento por mês |
|---|---|---|
| RJ + SP | ~3,2 GB | US$ 1,12 |
| Brasil (matrizes) | ~8,5 GB | US$ 2,98 |
| Brasil + índice de busca por nome (trigram, ~3 GB, estimado) | ~11,5 GB | US$ 4,03 |

## Computação: é o que mais pesa na conta

Depende de quantas horas o banco fica ligado e de quanto ele usa. O banco suspende sozinho depois de 5 minutos parado.

| Uso | CU-horas por mês | Custo de computação |
|---|---|---|
| Leve (poucas horas por dia, ~0,5 CU) | ~90 | US$ 9,50 |
| Moderado (12 h por dia, ~1 CU) | ~360 | US$ 38 |
| Sempre ligado, 0,5 CU | ~365 | US$ 38 |
| Sempre ligado, 1 CU | ~730 | US$ 77 |

## Total estimado por mês

| Cenário | Leve | Moderado | Sempre ligado (1 CU) |
|---|---|---|---|
| RJ + SP (3,2 GB) | ~US$ 11 | ~US$ 40 | ~US$ 79 |
| Brasil (8,5 GB) | ~US$ 13 | ~US$ 42 | ~US$ 81 |
| Brasil + índice trigram (11,5 GB) | ~US$ 14 | ~US$ 43 | ~US$ 82 |

Inclui cerca de US$ 1 por mês para o restore de 1 a 7 dias. Faturas abaixo de US$ 0,50 não são cobradas.

**Custo único da carga:** importar 27 milhões de linhas leva algumas horas a 2 CU, algo como US$ 1 a 2. O GitHub Actions faz a leitura sem custo.

## Observações

- **O armazenamento é barato; a computação é que define a conta.** Passar do RJ para o Brasil inteiro soma só cerca de US$ 2 de armazenamento.
- **Busca por nome em 27 milhões de linhas sem índice** é uma varredura e consome computação (e demora). O índice trigram custa cerca de US$ 1 por mês de armazenamento e evita ligar um CU grande só para buscar. Vale criar junto com a carga.
- **Estes números são estimativas minhas.** Preços e tamanhos são reais (medidos e lidos na página), mas as horas de uso e o tamanho do índice são suposições. Depois de uma semana de uso o painel do Neon mostra o consumo real.
- **Alternativa mais barata e escalável (opção B):** um serviço pequeno com DuckDB sobre os arquivos da Receita, em torno de US$ 5 a 15 por mês, sem depender do tamanho do banco.
