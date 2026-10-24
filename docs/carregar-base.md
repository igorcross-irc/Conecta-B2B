# Como carregar mais da base da Receita

A pesquisa só encontra o que está na tabela `rf_estabelecimento`. Hoje ela tem **só o Rio de Janeiro** (2,2 milhões de matrizes ativas).
Por isso uma pesquisa em São Paulo (ou qualquer outro estado) volta com 0 empresa, mesmo que a empresa exista. A tela agora avisa isso.

O plano grátis do Neon tem 1 GB, e cada empresa ocupa cerca de 450 bytes com índices: São Paulo inteiro (milhões de empresas) não cabe.
Há três caminhos, do mais simples ao mais completo.

## 1. Abrir pelo CNPJ (já funciona, qualquer estado)

Em **Descobrir**, informe o CNPJ ou o site. A ficha vem direto das APIs (BrasilAPI, Minha Receita e CNPJá), sem depender da base carregada.
Na Pesquisar, digitar um CNPJ de 14 dígitos no campo de nome mostra o botão para abrir a ficha.

## 2. Importar só o recorte que você precisa (cabe no plano grátis)

GitHub → Actions → **Importar Receita** → Run workflow. Campos:

| Campo | Exemplo | O que faz |
|---|---|---|
| `ufs` | `SP` | Limita ao estado (vazio = todos, só use junto com `busca` ou `raizes`) |
| `busca` | `padaria estrela` | Só empresas cuja razão social ou nome fantasia tenham **todas** as palavras |
| `raizes` | `33000167,12345678` | Todos os estabelecimentos destes CNPJs-raiz (8 primeiros dígitos), em qualquer estado; marque `filiais=true` |
| `filiais` | `true` | Inclui filiais (padrão: só matrizes) |

Exemplos:
- **As razões sociais da sua empresa em SP:** `ufs=SP`, `busca=<nome do grupo>`, `filiais=true`. Ou, se você sabe os CNPJs, `raizes=<raiz1>,<raiz2>`, `filiais=true`.
- **Um segmento de uma cidade:** não há filtro por atividade nesse recorte; use `busca` com uma palavra do nome (ex.: `clinica`).

Medido contra o espelho real: recorte por CNPJ-raiz leva cerca de 30 s; recorte por nome em um estado, cerca de 1 min 20 s.
Precisa do secret `DATABASE_URL` (a URL do **dono** do banco, não a do papel `conecta_app`). Ao final o importador atualiza a lista de cidades das sugestões.

Também dá para rodar no seu computador:

```bash
DATABASE_URL=postgres://... npx tsx scripts/importar-receita.ts --ufs=SP --busca="nome da empresa" --filiais
DATABASE_URL=postgres://... npx tsx scripts/importar-receita.ts --raizes=33000167 --filiais
```

## 3. Carregar o estado inteiro

Precisa de mais espaço do que o plano grátis. Opções: plano pago do Neon (o importador já suporta `--ufs=SP`), ou reduzir o que se guarda
(por exemplo, sem filiais e só os campos usados na busca). A pesquisa por nome é uma varredura (sem índice trigram, que não coube no 1 GB):
com SP junto, ela fica mais lenta; aí vale reativar o índice de `db/neon/0006_busca_trigram.sql` num plano com mais disco.
