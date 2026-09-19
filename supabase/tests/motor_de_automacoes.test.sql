-- =============================================================================
-- Motor de automações — cobertura automatizada
-- =============================================================================
--
-- Rode com:  supabase test db   (exige Docker). No CI, job `banco`.
--
-- Cobre 20260919040000_motor_de_automacoes.sql: condições em lista com
-- "igual", "diferente" e "contém"; valores em português normalizados; ações de
-- atribuir, prioridade, resposta automática e notificar; histórico gravado em
-- automation_logs; e o acesso restrito a gestor.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

CREATE TEMP TABLE fixture (chave text PRIMARY KEY, valor uuid);
INSERT INTO fixture (chave, valor) VALUES
  ('gestor',  '55555555-5555-5555-5555-555555555555'),
  ('tecnico', '66666666-6666-6666-6666-666666666666'),
  ('cliente', '77777777-7777-7777-7777-777777777777');

CREATE FUNCTION pg_temp.ref(k text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT valor FROM fixture WHERE chave = k $$;

INSERT INTO auth.users (id, instance_id, email, aud, role)
SELECT valor, '00000000-0000-0000-0000-000000000000', chave || '-automacao@orion.local',
       'authenticated', 'authenticated'
  FROM fixture
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET full_name = 'Gestor Teste Automacao'  WHERE id = pg_temp.ref('gestor');
UPDATE public.profiles SET full_name = 'Tecnico Teste Automacao' WHERE id = pg_temp.ref('tecnico');
INSERT INTO public.user_roles (user_id, role) VALUES
  (pg_temp.ref('gestor'), 'admin'),
  (pg_temp.ref('tecnico'), 'technician')
ON CONFLICT DO NOTHING;

INSERT INTO fixture (chave, valor)
SELECT 'empresa', company_id FROM public.profiles WHERE id = pg_temp.ref('cliente');

CREATE FUNCTION pg_temp.entrar(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.ref(quem)::text)::text, true);
END $$;

CREATE FUNCTION pg_temp.sair() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- Regras da fixture são as únicas da empresa durante o teste.
UPDATE public.routing_rules SET is_active = false WHERE company_id = pg_temp.ref('empresa');

INSERT INTO public.canned_responses (id, company_id, title, content, created_by)
VALUES ('88888888-8888-8888-8888-888888888888', pg_temp.ref('empresa'), 'Recebido', 'Recebemos seu chamado.',
        pg_temp.ref('gestor'));

INSERT INTO public.routing_rules (company_id, name, priority, created_by, conditions, actions) VALUES
  -- Duas condições, valor em português e ação dupla.
  (pg_temp.ref('empresa'), 'Impressora urgente', 1, pg_temp.ref('gestor'),
   '[{"field":"category","operator":"equals","value":"impressora"},
     {"field":"title","operator":"contains","value":"toner"}]',
   '[{"type":"assign_tech","target":"66666666-6666-6666-6666-666666666666"},
     {"type":"set_priority","target":"urgente"},
     {"type":"auto_response","target":"88888888-8888-8888-8888-888888888888"}]'),
  -- Formato antigo (objeto), com "diferente de".
  (pg_temp.ref('empresa'), 'Tudo que nao e rede avisa', 2, pg_temp.ref('gestor'),
   '{"field":"category","operator":"not_equals","value":"rede"}',
   '{"type":"notify_all","target":""}');

CREATE FUNCTION pg_temp.abrir(chave text, categoria text, titulo text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM pg_temp.entrar('cliente');
  INSERT INTO public.tickets (user_id, requester_name, title, description, category, priority, status)
  VALUES (pg_temp.ref('cliente'), 'Cliente Teste', titulo,
          'Descricao longa o bastante para satisfazer a constraint de comprimento minimo do chamado.',
          categoria, 'low', 'open')
  RETURNING id INTO v_id;
  PERFORM pg_temp.sair();
  INSERT INTO fixture (chave, valor) VALUES (chave, v_id);
END $$;

-- -----------------------------------------------------------------------------
-- 1-6. Chamado que casa com as duas regras
-- -----------------------------------------------------------------------------
SELECT pg_temp.abrir('casa', 'impressora', 'Acabou o toner da impressora');

SELECT is( (SELECT assigned_to_user_id FROM public.tickets WHERE id = pg_temp.ref('casa')),
  pg_temp.ref('tecnico'), 'duas condicoes casando atribuem ao tecnico da regra' );

SELECT is( (SELECT priority FROM public.tickets WHERE id = pg_temp.ref('casa')),
  'urgent', 'prioridade em portugues na regra vira urgent' );

SELECT is( (SELECT count(*)::int FROM public.automation_logs WHERE ticket_id = pg_temp.ref('casa')),
  4, 'historico grava uma linha por acao disparada' );

SELECT is( (SELECT author_id FROM public.ticket_updates
             WHERE ticket_id = pg_temp.ref('casa') AND content = 'Recebemos seu chamado.'),
  pg_temp.ref('gestor'), 'resposta automatica sai assinada por quem criou a regra, nao pelo cliente' );

SELECT ok( EXISTS (SELECT 1 FROM public.notifications
                    WHERE user_id = pg_temp.ref('tecnico') AND link = '/ticket/' || pg_temp.ref('casa')),
  'notificar todos avisa o tecnico da empresa' );

SELECT ok( (SELECT metadata ? 'automacoes' FROM public.tickets WHERE id = pg_temp.ref('casa')),
  'o chamado guarda o que disparou' );

-- -----------------------------------------------------------------------------
-- 7-8. Uma condição falha: a regra inteira não dispara
-- -----------------------------------------------------------------------------
SELECT pg_temp.abrir('meio', 'impressora', 'Impressora fazendo barulho');

SELECT is( (SELECT assigned_to_user_id FROM public.tickets WHERE id = pg_temp.ref('meio')),
  NULL::uuid, 'sem "toner" no titulo a primeira regra nao atribui' );

SELECT is( (SELECT priority FROM public.tickets WHERE id = pg_temp.ref('meio')),
  'low', 'e a prioridade fica como veio' );

-- -----------------------------------------------------------------------------
-- 9. "Diferente de" exclui o valor
-- -----------------------------------------------------------------------------
SELECT pg_temp.abrir('rede', 'rede', 'Sem internet');

SELECT is( (SELECT count(*)::int FROM public.automation_logs WHERE ticket_id = pg_temp.ref('rede')),
  0, 'chamado de rede nao dispara a regra "diferente de rede"' );

-- -----------------------------------------------------------------------------
-- 10-12. Acesso
-- -----------------------------------------------------------------------------
-- Como superusuário a RLS não vale: as contagens abaixo rodam no papel
-- authenticated, o mesmo da API. As respostas vão para uma tabela temporária
-- porque pg_temp.ref não é visível para esse papel.
CREATE TEMP TABLE acesso (quem text, regras int, historico int);
GRANT ALL ON acesso TO authenticated;

DO $$
DECLARE v_empresa uuid := pg_temp.ref('empresa'); v_chamado uuid := pg_temp.ref('casa');
        v_tecnico uuid := pg_temp.ref('tecnico'); v_gestor uuid := pg_temp.ref('gestor');
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tecnico::text)::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO acesso VALUES ('tecnico',
    (SELECT count(*) FROM public.routing_rules WHERE company_id = v_empresa),
    (SELECT count(*) FROM public.automation_logs WHERE ticket_id = v_chamado));
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gestor::text)::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO acesso VALUES ('gestor',
    (SELECT count(*) FROM public.routing_rules WHERE company_id = v_empresa),
    (SELECT count(*) FROM public.automation_logs WHERE ticket_id = v_chamado));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

SELECT is( (SELECT regras + historico FROM acesso WHERE quem = 'tecnico'),
  0, 'tecnico nao ve regras nem historico' );
SELECT ok( (SELECT regras FROM acesso WHERE quem = 'gestor') >= 2,
  'gestor da empresa ve as regras' );
SELECT is( (SELECT historico FROM acesso WHERE quem = 'gestor'),
  4, 'gestor ve o historico' );

SELECT * FROM finish();

ROLLBACK;
