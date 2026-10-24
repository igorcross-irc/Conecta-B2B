# Banco nacional enxuto + detalhes sob demanda

Pergunta: dá para ter resultados do Brasil inteiro no mesmo espaço, guardando pouco de cada empresa e buscando o resto só quando alguém abre a empresa? **Dá**, e o sistema já faz a segunda metade (`consultarEmpresa` consulta BrasilAPI → Minha Receita → CNPJá e guarda em `empresa_cache`).

## Medido (24/10/2026)

| O quê | Valor | Como |
|---|---|---|
| Matrizes ativas no Brasil | 27.049.051 | DuckDB sobre a base aberta da Receita (espelho no Hugging Face) |
| Dessas, Empresário Individual (natureza jurídica 2135, inclui MEI) | 16.658.824 (**61,6%**) | idem |
| Sem Empresário Individual | ~10,39 mi | diferença |
| Linha completa hoje (RJ, 2.222.761 linhas) | 244 bytes na tabela + 97 MB de índices + 91 MB do índice de palavras | `pg_table_size` no Neon |
| Tamanho médio das colunas | razão social 38 B, fantasia 20, texto de busca 42, bairro 12, município 13,5, e-mail 26 (89% têm), telefone 11 (97% têm), CNPJ 15, CNAE 4, abertura 4 | `pg_column_size` em amostra de 5% |

## Estimado (a partir do RJ; ordem de grandeza, não promessa)

| Cenário | Linhas | Tabela | Índices | Total |
|---|---|---|---|---|
| Hoje, linha completa, Brasil | 27,05 mi | ~6,6 GB | ~2,3 GB | **~9 GB** |
| Enxuta, Brasil | 27,05 mi | ~2,6 GB | ~2,0 GB | **~4,7 GB** |
| Completa, sem Empresário Individual | 10,39 mi | ~2,5 GB | ~0,9 GB | **~3,5 GB** |
| Enxuta, sem Empresário Individual | 10,39 mi | ~1,0 GB | ~0,8 GB | **~1,8 GB** |

(O índice de palavras de ~91 MB por 2,2 mi empresas substitui o de trigramas, que passaria de 400 MB.)

## Linha enxuta (o que guardaria por empresa)

CNPJ (número), razão social, UF, código do município, CNAE, porte, data de abertura, e dois sinais "tem e-mail" / "tem telefone". ~95 bytes por linha. **Sai:** e-mail, telefone, bairro, nome fantasia e texto de busca duplicado.

## O que se ganha e o que se perde

- **Ganha:** resultados do Brasil inteiro na Pesquisa e no Mercado (setor, porte, UF, cidade, idade, "com e-mail/telefone") com metade do espaço, ou menos de um quinto sem Empresário Individual. Abrir uma empresa traz o resto na hora (as APIs abertas) e fica guardado.
- **Perde:** filtro por bairro e busca pelo nome fantasia nacionais; planilha de empresas com e-mail/telefone/endereço (só sai o que está na linha enxuta, a menos que a empresa tenha sido aberta antes); o Mercado nacional deixa de mostrar o texto do contato, só a porcentagem.
- **Cuidado:** as APIs abertas têm limite de consultas. Servem para "abrir uma empresa por clique", não para completar 5.000 linhas de uma exportação.

## Decisões de produto que mudam o tamanho

1. **Incluir Empresário Individual?** São 61,6% das matrizes. Para vender para empresas, a maioria é ruído (o "decisor" é a própria pessoa). Excluir por padrão, com opção de incluir depois.
2. **Camadas:** linha completa só onde a equipe trabalha (ex.: RJ) e enxuta no resto.

## Caminho de implementação (não feito)

Importador `--enxuto` (migração com e-mail/telefone/bairro opcionais), pesquisa tolerando colunas vazias, aviso na tela quando o filtro pedido não existe no recorte nacional, e a carga por GitHub Actions por UF. Estimativa: ~1 a 2 dias de trabalho mais algumas horas de carga.
