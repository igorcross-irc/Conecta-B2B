# API pública (somente leitura)

Crie uma chave em **Configurações → Chaves de API** (só administradores). O texto da chave aparece uma vez. Envie em todo pedido:

```
Authorization: Bearer cb2b_...
```

Limite: 600 pedidos por hora por organização (`429` ao passar). Chave inválida ou revogada: `401`. Nenhum destes endereços gasta créditos.
A chave deixa de valer se quem a criou deixar de ser administrador da organização.

| Endereço | O que devolve |
|---|---|
| `GET /api/v1/empresa?cnpj=33000167000101` | Ficha da empresa (situação, porte, CNAE, endereço, sócios, ...) |
| `GET /api/v1/pesquisar?uf=RJ&termos=padaria&abertura=novas&pagina=0` | Empresas da base da Receita (25 por página) |
| `GET /api/v1/creditos` | `{ "saldo": 42 }` |

Filtros de `/api/v1/pesquisar`: `nome`, `termos`, `uf`, `cidade`, `bairro`, `segmento`, `setor` (repetível), `porte` (repetível),
`abertura` (`novas`, `1a3`, `3a10`, `10mais`), `email=1`, `telefone=1`, `filiais=1`, `ordem=recentes`, `pagina`.

Busca de pessoas e revelação de e-mail/telefone gastam créditos e continuam só pela interface.

```bash
curl -H "Authorization: Bearer $CONECTA_CHAVE" "https://conecta-b2b.vercel.app/api/v1/empresa?cnpj=33000167000101"
```
