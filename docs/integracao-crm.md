# Integração com CRM: o que precisa ser feito

## Hoje

Exportação em CSV nos formatos de importação do **HubSpot, RD Station e Pipedrive** (tela Listas). Só sai o que já foi revelado.

## Integração direta (enviar a lista para o CRM com um clique)

Para cada CRM, o trabalho é parecido:

1. **Conexão por organização** (Configurações > Integrações): o administrador cola a chave da API do CRM dele (ou autoriza por OAuth, mais seguro e mais trabalhoso). A chave fica criptografada no banco e nunca volta para a tela.
2. **Mapeamento de campos:** empresa vira *Company/Organização*; pessoa vira *Contact/Pessoa*, com cargo, e-mail, telefone, LinkedIn e origem. Um campo personalizado guarda o CNPJ para evitar duplicar a empresa.
3. **Envio idempotente:** repetir o envio não duplica (atualiza pelo e-mail ou pelo CNPJ). Cada envio fica num histórico (o que foi, quando, erro), com repetição automática se o CRM estiver fora ou limitar o ritmo.
4. **Botão "Enviar ao CRM"** em cada lista e, depois, envio automático ao revelar um contato (opcional).
5. **LGPD:** só vão contatos revelados; o opt-out precisa também avisar o CRM (ou ao menos marcar o contato) — hoje o apagamento cobre só o nosso banco.

## O que eu preciso de você

- **Qual CRM primeiro.** No Brasil o RD Station CRM e o HubSpot são os mais comuns; o Pipedrive vem em seguida. Cada um é cerca de 2 a 3 dias de trabalho meu, e o primeiro leva um pouco mais por criar a base (tela de conexão, cofre da chave, histórico de envios).
- **Uma conta de teste** (gratuita ou sandbox) e a chave da API dela, para eu validar com respostas reais. Sem isso eu escreveria pela documentação, como aconteceu com Hunter e Tavily, e não teria como garantir.
- Decisão sobre **envio automático ou só manual** no começo (manual é mais seguro).
