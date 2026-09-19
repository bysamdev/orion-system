-- =============================================================================
-- Chamado "Em Atendimento" sempre tem responsável — cobertura automatizada
-- =============================================================================
--
-- Rode com:  supabase test db   (exige Docker). No CI, job `banco`.
--
-- Cobre 20260919020000_em_atendimento_sempre_com_responsavel.sql:
-- alterar_status_chamado atribui a quem muda para in-progress (se for equipe
-- interna e o chamado não tiver responsável) e atribuir_chamado(NULL) num
-- chamado em atendimento devolve o status para open.
--
-- Montagem sem sessão (auth.uid() nulo), como em avaliacao_pendente.test.sql;
-- a sessão só é ligada no instante de chamar a função testada.
--
-- Executada em 19/09/2026 contra o banco de produção, com a migration, numa
-- transação desfeita: os 10 testes passaram. Com as funções antigas, os testes
-- de atribuição, timeline e devolução à fila falharam, como deviam.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(10);

CREATE TEMP TABLE fixture (chave text PRIMARY KEY, valor uuid);

INSERT INTO fixture (chave, valor) VALUES
  ('tecnico', '22222222-2222-2222-2222-222222222222'),
  ('outro',   '33333333-3333-3333-3333-333333333333'),
  ('cliente', '44444444-4444-4444-4444-444444444444');

CREATE FUNCTION pg_temp.ref(k text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT valor FROM fixture WHERE chave = k $$;

-- Um gatilho de cadastro cria o profile de cada usuário na empresa padrão.
INSERT INTO auth.users (id, instance_id, email, aud, role)
SELECT valor, '00000000-0000-0000-0000-000000000000', chave || '-atendimento@orion.local',
       'authenticated', 'authenticated'
  FROM fixture
ON CONFLICT (id) DO NOTHING;

-- validate_ticket_assignment procura o responsável pelo nome e exige papel de
-- equipe; nomes únicos evitam casar com alguém do banco.
UPDATE public.profiles SET full_name = 'Tecnico Teste Atendimento' WHERE id = pg_temp.ref('tecnico');
UPDATE public.profiles SET full_name = 'Outro Teste Atendimento'   WHERE id = pg_temp.ref('outro');

INSERT INTO public.user_roles (user_id, role) VALUES
  (pg_temp.ref('tecnico'), 'technician'),
  (pg_temp.ref('outro'),   'technician')
ON CONFLICT DO NOTHING;

CREATE FUNCTION pg_temp.entrar(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', pg_temp.ref(quem)::text)::text, true);
END $$;

CREATE FUNCTION pg_temp.sair() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- set_ticket_company_from_user exige sessão no INSERT; o chamado nasce como
-- se o cliente o tivesse aberto.
CREATE FUNCTION pg_temp.criar_chamado(chave text, st text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM pg_temp.entrar('cliente');
  INSERT INTO public.tickets (user_id, requester_name, title, description, category, priority, status)
  VALUES (pg_temp.ref('cliente'), 'Cliente de Teste', 'chamado ' || chave,
          'Descricao longa o bastante para satisfazer a constraint de comprimento minimo do chamado.',
          'outros', 'medium', st)
  RETURNING id INTO v_id;
  PERFORM pg_temp.sair();
  INSERT INTO fixture (chave, valor) VALUES (chave, v_id);
END $$;

CREATE FUNCTION pg_temp.responsavel(chave text) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT assigned_to_user_id FROM public.tickets WHERE id = pg_temp.ref(chave)
$$;

CREATE FUNCTION pg_temp.status(chave text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT status FROM public.tickets WHERE id = pg_temp.ref(chave)
$$;

-- -----------------------------------------------------------------------------
-- 1-3. Técnico muda para Em Atendimento um chamado sem responsável
-- -----------------------------------------------------------------------------
SELECT pg_temp.criar_chamado('sem_resp', 'open');

SELECT pg_temp.entrar('tecnico');
SELECT public.alterar_status_chamado(pg_temp.ref('sem_resp'), 'in-progress');
SELECT pg_temp.sair();

SELECT is( pg_temp.responsavel('sem_resp'), pg_temp.ref('tecnico'),
  'mudar para em atendimento sem responsavel atribui a quem mudou' );

SELECT is( (SELECT assigned_to FROM public.tickets WHERE id = pg_temp.ref('sem_resp')),
  'Tecnico Teste Atendimento',
  'o nome do responsavel vem do perfil' );

SELECT ok( EXISTS (SELECT 1 FROM public.ticket_updates
                    WHERE ticket_id = pg_temp.ref('sem_resp') AND type = 'assignment'),
  'a atribuicao aparece na timeline' );

-- -----------------------------------------------------------------------------
-- 4. Chamado que já tem responsável não troca de dono
-- -----------------------------------------------------------------------------
SELECT pg_temp.criar_chamado('com_resp', 'awaiting-customer');
UPDATE public.tickets SET assigned_to_user_id = pg_temp.ref('outro') WHERE id = pg_temp.ref('com_resp');

SELECT pg_temp.entrar('tecnico');
SELECT public.alterar_status_chamado(pg_temp.ref('com_resp'), 'in-progress');
SELECT pg_temp.sair();

SELECT is( pg_temp.responsavel('com_resp'), pg_temp.ref('outro'),
  'chamado com responsavel mantem o responsavel ao voltar para em atendimento' );

-- -----------------------------------------------------------------------------
-- 5. Sem sessão (service_role, cron) só troca o status
-- -----------------------------------------------------------------------------
SELECT pg_temp.criar_chamado('servico', 'open');
SELECT public.alterar_status_chamado(pg_temp.ref('servico'), 'in-progress');

SELECT is( pg_temp.responsavel('servico'), NULL::uuid,
  'sem sessao ninguem e atribuido' );

-- -----------------------------------------------------------------------------
-- 6. Cliente não vira responsável
-- -----------------------------------------------------------------------------
SELECT pg_temp.criar_chamado('pelo_cliente', 'open');

SELECT pg_temp.entrar('cliente');
SELECT public.alterar_status_chamado(pg_temp.ref('pelo_cliente'), 'in-progress');
SELECT pg_temp.sair();

SELECT is( pg_temp.responsavel('pelo_cliente'), NULL::uuid,
  'cliente nao e atribuido como responsavel' );

-- -----------------------------------------------------------------------------
-- 7. Outros status não atribuem
-- -----------------------------------------------------------------------------
SELECT pg_temp.criar_chamado('aguardando', 'open');

SELECT pg_temp.entrar('tecnico');
SELECT public.alterar_status_chamado(pg_temp.ref('aguardando'), 'awaiting-customer');
SELECT pg_temp.sair();

SELECT is( pg_temp.responsavel('aguardando'), NULL::uuid,
  'mudar para outro status nao atribui ninguem' );

-- -----------------------------------------------------------------------------
-- 8-9. Desatribuir quem está em atendimento devolve à fila
-- -----------------------------------------------------------------------------
SELECT pg_temp.entrar('tecnico');
SELECT public.atribuir_chamado(pg_temp.ref('sem_resp'), NULL, NULL);
SELECT pg_temp.sair();

SELECT is( pg_temp.status('sem_resp'), 'open',
  'desatribuir chamado em atendimento volta o status para open' );

SELECT is( pg_temp.responsavel('sem_resp'), NULL::uuid,
  'e o chamado fica sem responsavel' );

-- -----------------------------------------------------------------------------
-- 10. Desatribuir fora de atendimento não mexe no status
-- -----------------------------------------------------------------------------
UPDATE public.tickets SET assigned_to_user_id = pg_temp.ref('outro') WHERE id = pg_temp.ref('aguardando');

SELECT pg_temp.entrar('tecnico');
SELECT public.atribuir_chamado(pg_temp.ref('aguardando'), NULL, NULL);
SELECT pg_temp.sair();

SELECT is( pg_temp.status('aguardando'), 'awaiting-customer',
  'desatribuir chamado aguardando cliente mantem o status' );

SELECT * FROM finish();

ROLLBACK;
