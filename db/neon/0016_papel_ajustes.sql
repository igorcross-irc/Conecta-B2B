-- Ajustes no papel limitado do app, JÁ APLICADOS no Neon de produção em 24/10/2026 (junto com o teste de RLS descrito em docs/papel-de-banco.md).
-- 1) Permite ao dono do banco testar o papel com `set local role conecta_app` (não dá poder novo: o dono já pode tudo).
grant conecta_app to current_user;
-- 2) Consultas do app não passam de 20 s (uma pesquisa muito ampla falha rápido em vez de segurar o banco).
alter role conecta_app set statement_timeout = '20s';
