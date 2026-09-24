-- Os papéis de banco "admin" e "developer" (não confundir com os papéis do
-- app em user_roles) não foram criados por nenhuma migração: sobra de algo
-- antigo. Em 23/09/2026 os dois podiam fazer login, tinham SELECT/INSERT/
-- UPDATE/DELETE/TRUNCATE em 51 e 44 tabelas de public, não eram donos de
-- nenhum objeto, não apareciam em policy e não tinham conexão ativa.
--
-- Decisão do Sam: desligar, de forma reversível. Os papéis continuam
-- existindo; para voltar atrás: ALTER ROLE ... LOGIN e refazer os GRANTs.
--
-- Condicional para o replay em banco limpo (CI), onde eles não existem.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'developer'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER ROLE %I NOLOGIN', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
    END IF;
  END LOOP;
END $$;
