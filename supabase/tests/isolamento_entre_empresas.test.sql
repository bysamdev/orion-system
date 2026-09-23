-- =============================================================================
-- Isolamento entre empresas (ORN-INC-05) — cobertura automatizada
-- =============================================================================
--
-- Rode com:  supabase test db   (exige Docker). No CI, job `banco`.
--
-- Executada em 23/09/2026 contra o banco de produção, numa transação
-- desfeita: os 20 testes passaram.
--
-- Os outros testes rodam como postgres, que ignora a RLS. Aqui cada consulta
-- passa por pg_temp.como(), que entra com a sessão de um usuário e troca para
-- o papel authenticated só durante aquela consulta, como faz o PostgREST.
--
-- Cenário: empresas A e B (clientes) e uma empresa mãe M.
--   A: cliente A1, cliente A2, admin A      B: cliente B1, admin B
--   M: técnico M (equipe interna)
-- Um chamado de A1, um de A2 e um de B1.
--
-- Cobre, além da RLS de tickets/ticket_updates/profiles/notifications, as
-- correções da auditoria de 23/09/2026: SEC-17 (busca), SEC-20 (autor e nota
-- interna), SEC-23 (admin de cliente), SEC-27 (perfil) e o fechamento das
-- funções auxiliares para quem não está logado.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(20);

-- Os cenários abrem vários chamados seguidos do mesmo cliente; a trava de
-- abertura (20260924030000) é coberta à parte.
SET LOCAL orion.limite_de_abertura = 'off';

-- Identificadores fixos: as consultas rodam como authenticated, que não
-- enxerga tabelas temporárias do postgres.
--   empresas  e0000000-...-00000000000a / b / c
--   usuários  e1000000-...-0000000000a1 / a2 / aa / b1 / bb / 0c
--   chamados  e2000000-...-0000000000a1 / a2 / b1

INSERT INTO public.companies (id, name, is_master) VALUES
  ('e0000000-0000-0000-0000-00000000000a', 'Empresa A Teste Isolamento', false),
  ('e0000000-0000-0000-0000-00000000000b', 'Empresa B Teste Isolamento', false),
  ('e0000000-0000-0000-0000-00000000000c', 'Empresa Mae Teste Isolamento', true)
ON CONFLICT (id) DO NOTHING;

-- Um gatilho de cadastro cria o profile de cada usuário.
INSERT INTO auth.users (id, instance_id, email, aud, role)
SELECT u.id::uuid, '00000000-0000-0000-0000-000000000000', u.email, 'authenticated', 'authenticated'
  FROM (VALUES
    ('e1000000-0000-0000-0000-0000000000a1', 'a1-isolamento@orion.local'),
    ('e1000000-0000-0000-0000-0000000000a2', 'a2-isolamento@orion.local'),
    ('e1000000-0000-0000-0000-0000000000aa', 'aa-isolamento@orion.local'),
    ('e1000000-0000-0000-0000-0000000000b1', 'b1-isolamento@orion.local'),
    ('e1000000-0000-0000-0000-0000000000bb', 'bb-isolamento@orion.local'),
    ('e1000000-0000-0000-0000-00000000000c', 'm-isolamento@orion.local')
  ) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

-- validate_company_assignment só deixa trocar a empresa com service_role.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.profiles p SET company_id = v.empresa::uuid, full_name = v.nome
  FROM (VALUES
    ('e1000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-00000000000a', 'Cliente A1 Isolamento'),
    ('e1000000-0000-0000-0000-0000000000a2', 'e0000000-0000-0000-0000-00000000000a', 'Cliente A2 Isolamento'),
    ('e1000000-0000-0000-0000-0000000000aa', 'e0000000-0000-0000-0000-00000000000a', 'Admin A Isolamento'),
    ('e1000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-00000000000b', 'Cliente B1 Isolamento'),
    ('e1000000-0000-0000-0000-0000000000bb', 'e0000000-0000-0000-0000-00000000000b', 'Admin B Isolamento'),
    ('e1000000-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-00000000000c', 'Tecnico M Isolamento')
  ) AS v(id, empresa, nome)
 WHERE p.id = v.id::uuid;
SELECT set_config('request.jwt.claims', '', true);

DELETE FROM public.user_roles WHERE user_id::text LIKE 'e1000000-%';
INSERT INTO public.user_roles (user_id, role) VALUES
  ('e1000000-0000-0000-0000-0000000000a1', 'customer'),
  ('e1000000-0000-0000-0000-0000000000a2', 'customer'),
  ('e1000000-0000-0000-0000-0000000000aa', 'admin'),
  ('e1000000-0000-0000-0000-0000000000b1', 'customer'),
  ('e1000000-0000-0000-0000-0000000000bb', 'admin'),
  ('e1000000-0000-0000-0000-00000000000c', 'technician');

-- Executa uma consulta com a sessão de um usuário (ou sem login, quem = NULL)
-- e devolve o primeiro valor como texto. Erros viram o texto 'ERRO: ...'.
CREATE FUNCTION pg_temp.como(quem text, consulta text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  IF quem IS NULL THEN
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', 'e1000000-0000-0000-0000-0000000000' || quem, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
  END IF;
  BEGIN
    EXECUTE consulta INTO v;
  EXCEPTION WHEN others THEN
    v := 'ERRO: ' || SQLERRM;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN v;
END $$;

-- set_ticket_company_from_user exige sessão no INSERT: cada chamado nasce
-- como se o próprio cliente o tivesse aberto.
CREATE FUNCTION pg_temp.abrir(quem text, id text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'e1000000-0000-0000-0000-0000000000' || quem)::text, true);
  INSERT INTO public.tickets (id, user_id, requester_name, title, description, category, priority, status)
  VALUES (('e2000000-0000-0000-0000-0000000000' || id)::uuid,
          ('e1000000-0000-0000-0000-0000000000' || quem)::uuid,
          'Cliente ' || quem, 'palavrachaveisolamento chamado ' || id,
          'Descricao longa o bastante para satisfazer a constraint de comprimento minimo do chamado.',
          'outros', 'medium', 'open');
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

SELECT pg_temp.abrir('a1', 'a1');
SELECT pg_temp.abrir('a2', 'a2');
SELECT pg_temp.abrir('b1', 'b1');

-- set_ticket_update_author tira o autor da sessão.
SELECT set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000bb"}', true);
INSERT INTO public.ticket_updates (ticket_id, content, type, is_internal)
VALUES ('e2000000-0000-0000-0000-0000000000b1', 'resposta no chamado de B', 'comment', false);
SELECT set_config('request.jwt.claims', '', true);

INSERT INTO public.notifications (user_id, title, message, link)
VALUES ('e1000000-0000-0000-0000-0000000000b1', 'aviso de B', 'so para B1', '/');

-- Chamados ------------------------------------------------------------------

SELECT is( pg_temp.como('a1', $q$SELECT string_agg(right(id::text, 2), ',' ORDER BY id) FROM public.tickets WHERE id::text LIKE 'e2000000-%'$q$),
           'a1', 'cliente vê só o próprio chamado, nem o do colega nem o de outra empresa');

SELECT is( pg_temp.como('aa', $q$SELECT string_agg(right(id::text, 2), ',' ORDER BY id) FROM public.tickets WHERE id::text LIKE 'e2000000-%'$q$),
           'a1,a2', 'admin de cliente vê os chamados da própria empresa e nenhum de outra');

SELECT is( pg_temp.como('bb', $q$SELECT string_agg(right(id::text, 2), ',' ORDER BY id) FROM public.tickets WHERE id::text LIKE 'e2000000-%'$q$),
           'b1', 'admin da empresa B não vê chamados da empresa A');

SELECT is( pg_temp.como('0c', $q$SELECT string_agg(right(id::text, 2), ',' ORDER BY id) FROM public.tickets WHERE id::text LIKE 'e2000000-%'$q$),
           'a1,a2,b1', 'técnico da empresa mãe vê chamados de todas as empresas');

SELECT is( pg_temp.como(NULL, $q$SELECT count(*)::text FROM public.tickets$q$),
           '0', 'sem login não se vê nenhum chamado');

SELECT is( pg_temp.como('aa', $q$WITH u AS (UPDATE public.tickets SET priority = 'high' WHERE id = 'e2000000-0000-0000-0000-0000000000b1' RETURNING 1) SELECT count(*)::text FROM u$q$),
           '0', 'admin da empresa A não altera chamado da empresa B');

-- ORN-SEC-23: admin de cliente só muda status no chamado de um colega.
SELECT pg_temp.como('aa', $q$UPDATE public.tickets SET priority = 'critical', user_id = 'e1000000-0000-0000-0000-0000000000b1' WHERE id = 'e2000000-0000-0000-0000-0000000000a2' RETURNING 1$q$);
SELECT is( (SELECT priority || '/' || right(user_id::text, 2) FROM public.tickets WHERE id = 'e2000000-0000-0000-0000-0000000000a2'),
           'medium/a2', 'admin de cliente não troca prioridade nem dono do chamado do colega');

-- ORN-SEC-17: a busca respeita a RLS.
SELECT is( pg_temp.como('a1', $q$SELECT string_agg(right(id::text, 2), ',' ORDER BY id) FROM public.search_tickets('palavrachaveisolamento')$q$),
           'a1', 'busca do cliente devolve só o próprio chamado');

-- Timeline ------------------------------------------------------------------

SELECT is( pg_temp.como('a1', $q$SELECT count(*)::text FROM public.ticket_updates WHERE ticket_id = 'e2000000-0000-0000-0000-0000000000b1'$q$),
           '0', 'cliente de A não lê a timeline de chamado de B');

SELECT matches( pg_temp.como('a1', $q$INSERT INTO public.ticket_updates (ticket_id, content, type) VALUES ('e2000000-0000-0000-0000-0000000000b1', 'intrusao', 'comment') RETURNING 'ok'$q$),
           '^ERRO: ', 'cliente de A não escreve na timeline de chamado de B');

-- ORN-SEC-20: autor vem do perfil e cliente não grava nota interna.
SELECT is( pg_temp.como('a1', $q$INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal) VALUES ('e2000000-0000-0000-0000-0000000000a1', 'oi', 'comment', 'Suporte Orion', true) RETURNING author || '/' || is_internal::text$q$),
           'Cliente A1 Isolamento/false', 'cliente não se passa pelo suporte nem grava nota interna');

SELECT matches( pg_temp.como('a1', $q$INSERT INTO public.ticket_updates (ticket_id, content, type) VALUES ('e2000000-0000-0000-0000-0000000000a1', 'x', 'resolved') RETURNING 'ok'$q$),
           '^ERRO: ', 'cliente não grava tipo de atualização reservado à equipe');

-- Perfis e notificações ----------------------------------------------------

SELECT is( pg_temp.como('a1', $q$SELECT count(*)::text FROM public.profiles WHERE company_id = 'e0000000-0000-0000-0000-00000000000b'$q$),
           '0', 'cliente de A não vê perfis da empresa B');

SELECT is( pg_temp.como('aa', $q$SELECT count(*)::text FROM public.profiles WHERE company_id = 'e0000000-0000-0000-0000-00000000000b'$q$),
           '0', 'admin de A não vê perfis da empresa B');

SELECT is( pg_temp.como('a1', $q$SELECT count(*)::text FROM public.notifications WHERE user_id = 'e1000000-0000-0000-0000-0000000000b1'$q$),
           '0', 'ninguém lê notificações de outro usuário');

-- ORN-SEC-27: o próprio perfil só aceita dados pessoais.
SELECT matches( pg_temp.como('a1', $q$UPDATE public.profiles SET email = 'b1-isolamento@orion.local' WHERE id = 'e1000000-0000-0000-0000-0000000000a1' RETURNING 'ok'$q$),
           '^ERRO: ', 'usuário não troca o próprio e-mail');

SELECT matches( pg_temp.como('a1', $q$UPDATE public.profiles SET company_id = 'e0000000-0000-0000-0000-00000000000b' WHERE id = 'e1000000-0000-0000-0000-0000000000a1' RETURNING 'ok'$q$),
           '^ERRO: ', 'usuário não se muda para outra empresa');

SELECT is( pg_temp.como('a1', $q$UPDATE public.profiles SET phone = '11988887777' WHERE id = 'e1000000-0000-0000-0000-0000000000a1' RETURNING phone$q$),
           '11988887777', 'usuário continua editando o próprio telefone');

-- Funções auxiliares da RLS ------------------------------------------------

SELECT matches( pg_temp.como(NULL, $q$SELECT public.get_user_company_id('e1000000-0000-0000-0000-0000000000a1')::text$q$),
           '^ERRO: ', 'sem login não se descobre a empresa de um usuário');

SELECT is( pg_temp.como('a1', $q$SELECT (public.get_dashboard_stats()->>'error')$q$),
           'Unauthorized', 'cliente não vê os números do painel da empresa');

SELECT * FROM finish();

ROLLBACK;
