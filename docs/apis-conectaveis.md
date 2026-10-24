# APIs e fontes que podemos conectar

Levantamento feito em 24/10/2026. **"Testado"** quer dizer que chamei o endereço de verdade no ambiente de desenvolvimento e li a resposta real.
O que está marcado como **ligado** já está no app.

## Já ligadas (todas testadas com resposta real, exceto onde dito)

| Fonte | O que traz | Custo | Estado |
|---|---|---|---|
| BrasilAPI `/cnpj/v1` | Ficha da Receita: sócios com nome completo, CNAEs, endereço, porte | Grátis | Ligada, testada |
| Minha Receita `minhareceita.org/{cnpj}` | Mesmo formato da BrasilAPI (segunda fonte, para quando uma cair ou limitar) | Grátis | Ligada, testada |
| CNPJá aberta `open.cnpja.com` | Ficha + Simples/MEI + e-mail cadastral (dá o domínio) | Grátis, 5/min | Ligada, testada |
| CVM `dados.cvm.gov.br/.../cad_cia_aberta.csv` | 755 companhias abertas ativas: setor, controle acionário, auditor, **Diretor de RI com nome, e-mail e telefone** | Grátis (ODbL) | Ligada, testada |
| Wikidata (`wbsearchentities`/`wbgetentities`) | Funcionários, receita, fundação, LinkedIn da empresa. Só empresas notáveis (só 2.654 itens têm CNPJ); aceitamos quando CNPJ ou site conferem | Grátis (CC0) | Ligada, testada |
| Google Notícias (RSS) | Notícias dos últimos 30 dias pelo nome da empresa | Grátis | Ligada, testada |
| Portal da Transparência `/ceis`, `/cnep` | Empresas sancionadas pelo governo federal | Grátis, exige chave pessoal (e-mail) | Ligada; **sem a chave não foi testada com dados** (esquema conferido no OpenAPI da CGU) |
| Checagem de MX (DNS) | Descarta e-mail de domínio que não recebe mensagens | Grátis | Ligada, testada |
| Hunter, Tavily + Gemini | E-mails de pessoas, busca web de pessoas | Pago/limite grátis | Ligadas, **não testadas** (precisam de chave) |

## Testadas e disponíveis, ainda não ligadas

| Fonte | Para que serviria | Observação |
|---|---|---|
| CNPJ.ws pública `publica.cnpj.ws/cnpj/{cnpj}` | Terceira fonte da Receita | 3 pedidos por minuto |
| ReceitaWS `receitaws.com.br/v1/cnpj/{cnpj}` | Idem | 3 por minuto, termos mais restritos |
| ViaCEP / BrasilAPI `/cep/v2` | Completar endereço; o BrasilAPI v2 traz latitude e longitude | Grátis |
| Nominatim (OpenStreetMap) | Coordenadas e mapa de qualquer endereço | 1 pedido/s, exige identificação e cache |
| crt.sh `?q=%.dominio&output=json` | Descobrir subdomínios e confirmar que um domínio é da empresa | Grátis, lento |
| BNDES dados abertos (CKAN) | Empresas que receberam financiamento do BNDES | Arquivos grandes; ligar por importação |
| PNCP `pncp.gov.br/api/consulta/v1/contratos` | Contratos públicos (fora do escopo, só registro) | **O filtro por fornecedor é ignorado em silêncio** (testei `niFornecedor` e `cnpjFornecedor`: devolve 1,7 milhão de contratos de qualquer fornecedor). Só serve para varrer por data/órgão e cruzar depois. |
| Gdelt | Notícias globais | Limite de 1 pedido a cada 5 s |

## Não consegui alcançar daqui (provavelmente funcionam em produção; não verificado)

IBGE Localidades/CNAE (`servicodados.ibge.gov.br`), Querido Diário (diários oficiais municipais), Overpass (OpenStreetMap), RDAP do Registro.br (devolveu 403).

## Pagas ou com chave, para quem quiser mais cobertura

| Fonte | Valor para o produto | Observação |
|---|---|---|
| **Google Places API (New)** | Telefone, site, nota e horário de negócios locais. Cobre o varejo e o comércio pequeno, onde a Receita é fraca | Cobrado por campo pedido: telefone/site/nota sobem a chamada de "Pro" (US$ 32 por mil) para "Enterprise" (US$ 35 por mil), valores de blogs, conferir na tabela do Google |
| **Verificador de e-mail** (ZeroBounce, Kickbox, Emailable, MailboxValidator) | Passar de "domínio recebe e-mail" para "caixa existe". Cerca de US$ 0,008 por verificação | Faixa grátis pequena (100 a 300 por mês). Valores de blogs, conferir |
| Apollo, People Data Labs, Lusha, Snov, Cognism | Pessoas e e-mails com cobertura global | Cobertura no Brasil é desigual; testar antes de assinar |
| Econodata, Speedio, Casa dos Dados (API) | Base brasileira com faturamento estimado e contatos | Pago; faturamento e funcionários são hoje a maior lacuna da ficha |
| Serasa, Boa Vista, Quod | Score e restrições | Contrato e LGPD próprios |
| BuiltWith, Wappalyzer | Tecnologias usadas no site da empresa (útil para vender software) | Pago |
| LinkedIn | Cargos e pessoas | **Não ligar por raspagem**: viola os termos e a LGPD |

## Como ligar uma nova fonte

- **Informação da empresa** (aparece em "Informações extras"): crie `src/lib/enriquecimento/<fonte>.ts` com uma função que recebe a empresa e devolve um bloco, registre em `src/lib/enriquecimento/index.ts` (com validade de cache) e mostre em `Enriquecimento.tsx`. Falha de uma fonte não derruba as outras.
- **Pessoas** (aparecem em "Buscar pessoas"): implemente `ProvedorContatos` (`src/lib/providers/types.ts`) e inclua em `provedores()` em `src/lib/app.ts`. Cada contato precisa de `origem`, `obtidoEm` e `confianca`.
- Sempre guarde uma resposta real como fixture e escreva o teste do formato, como em `src/lib/providers/respostas-reais.test.ts`.
