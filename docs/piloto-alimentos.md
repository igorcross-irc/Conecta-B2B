# Piloto: segmento de alimentos (21/10/2026)

## O que foi (e o que não foi) testado
Teste reduzido, só com fontes gratuitas, em 5 empresas do setor. **Não é o teste de 50 empresas do roteiro**: não há chaves de provedores pagos nesta sessão, e a API pública de CNPJ testada (BrasilAPI) bloqueia acesso automatizado (robots.txt), então não contornei. Os dados cadastrais de CNPJ ficaram sem testar.

Método: busca na web por diretoria, cargos comerciais e de marketing em imprensa especializada, e leitura da página encontrada. Nenhum e-mail ou telefone foi inventado ou deduzido.

## Resultado por empresa
| Empresa (porte) | Decisores encontrados | Fonte | Data da informação | E-mail / telefone |
|---|---|---|---|---|
| M. Dias Branco (grande) | Anna Carolina Martins Teixeira, diretora de Marketing | [Mercado & Consumo](https://mercadoeconsumo.com.br/17/05/2025/gestao/m-dias-branco-dona-das-marcas-adria-e-piraque-tem-nova-diretora-de-marketing-confira-outras-mudancas/) | mai/2025 | Não encontrado |
| Camil Alimentos (grande) | Cauê Cruz, diretor executivo Comercial; Luciano Quartiero, CEO | [Supervarejo](https://supervarejo.com.br/gestao/caue-cruz-assume-como-diretor-comercial-na-camil-alimentos) | jul/2025 | Não encontrado |
| Bauducco (grande) | André Britto, CMO desde fev/2022 | [Forbes Brasil](https://forbes.com.br/forbes-mkt/2025/06/andre-britto-da-bauducco-liderar-o-marketing-e-uma-oportunidade-de-conectar-proposito-inovacao-e-resultados/) | jun/2025 | Não encontrado |
| BRF (grande) | Marcel Sacco, VP global de Marketing e Novos Negócios; Manoel Martins, VP Comercial Brasil; Luiz Franco, inovação e estratégia de categorias e marcas; Marcelo Suárez, diretor de Omnichannel e Trade Marketing | [ABC da Comunicação](https://www.abcdacomunicacao.com.br/brf-promove-mudancas-na-area-de-marketing-e-inovacao/) | jun/2022 | Não encontrado |
| Jasmine Alimentos (média) | Damian Allain, diretor de mercado | [Bem Paraná](https://www.bemparana.com.br/publicacao/coluna-people-s-a/novidades-na-jasmine-alimentos/) | ago/2015 | Não encontrado |

## O que o piloto mostra
1. **Nomes e cargos de grandes empresas aparecem em imprensa especializada**, de graça. Isso resolve "quem é" mas não "como falar".
2. **Nenhum e-mail ou telefone apareceu.** Contato direto exige provedor de contatos (pago) ou verificação de padrão de e-mail.
3. **A data da informação é decisiva.** Os dados da BRF têm mais de 4 anos e os da Jasmine mais de 10. A Jasmine foi adquirida pela M. Dias Branco em 2022 (conforme [O Povo](https://www.opovo.com.br/noticias/economia/2022/06/10251520-m-dias-branco-adquire-jasmine-empresa-com-foco-em-alimentos-integrais-e-organicos.html)), então o cargo de 2015 provavelmente já não vale. Todo contato precisa guardar fonte e data, com aviso de validade.
4. **Empresas pequenas e médias não geram notícia.** A busca por pequenas indústrias de alimentos (queijos, doces, conservas) só retornou diretórios genéricos e documentos acadêmicos, sem nome de decisor. Para essas, o provedor de contatos ou a base de CNPJ (sócios) é o caminho.
5. **Mudanças de cargo viram sinal de venda.** As notícias achadas são de contratações ("novo diretor"), um gatilho que uma ferramenta de vendas pode monitorar, junto com o que o projeto já previa sobre sinais.

## Conclusão provisória
- Fontes gratuitas (imprensa e site) servem para grandes empresas, para saber quem decide.
- Contato direto e cobertura de pequenas e médias dependem de provedor ou de base de CNPJ.
- Próximo passo para um teste válido: rodar a mesma amostra em 2 ou 3 provedores e medir cobertura, e-mail válido e custo (roteiro em `docs/custos-e-roteiro-de-teste.md`).

## Pendências
- Testar dados cadastrais por CNPJ com a base aberta baixada, ou uma API que permita uso automatizado.
- Montar a lista de 50 empresas de alimentos (10 grandes, 20 médias, 20 pequenas).
- Obter chaves de teste dos provedores (planos grátis).
