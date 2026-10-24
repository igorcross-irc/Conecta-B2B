-- Limite de pedidos em rotas públicas (contado no banco, vale para todos os servidores)
-- e confirmação do opt-out por e-mail (o link recebido prova que o pedido vem do dono do e-mail).

create table limite_pedido (
  chave     text not null,
  criado_em timestamptz not null default now()
);
create index limite_pedido_chave_idx on limite_pedido (chave, criado_em);

create table optout_pedido (
  token_hash text primary key,
  email      text not null check (email = lower(email)),
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null default now() + interval '2 hours',
  usado_em   timestamptz
);
create index optout_pedido_email_idx on optout_pedido (email, criado_em);

-- Tabelas internas do servidor: sem política para o cliente (acesso só pelo código do servidor).
alter table limite_pedido enable row level security;
alter table optout_pedido enable row level security;
