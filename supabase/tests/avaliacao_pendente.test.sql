-- =============================================================================
-- Regra de avaliação obrigatória — cobertura automatizada
-- =============================================================================
--
-- Rode com:  supabase test db   (exige Docker)
--
-- A regra saiu do TypeScript (onde tinha 13 testes) e virou função SQL em
-- 20260916230000_avaliacao_obrigatoria.sql. Ela é fonte única: a policy de
-- INSERT em tickets e o frontend, via RPC, leem da mesma lógica. Como ela
-- decide se alguém consegue ou não abrir chamado, cada ramo precisa de teste —
-- é fácil endurecer a regra sem querer, e o sintoma é um cliente travado.
--
-- ---------------------------------------------------------------------------
-- Estado desta suíte
--
-- Executada em 17/09/2026 contra o banco de produção, dentro de uma transação
-- desfeita (o próprio CREATE EXTENSION pgtap é transacional e some junto).
-- Os 9 testes passaram.
--
-- Depois disso a regra foi quebrada de propósito, na mesma forma de transação
-- desfeita, para conferir que a suíte sabe ficar vermelha: removendo a
-- exclusão de fechado_por_inatividade, o teste 6 falhou; removendo o LIMIT 1
-- da subconsulta, o teste 9 falhou. Nenhum outro teste se mexeu, o que mostra
-- que cada um cobre o ramo que diz cobrir.
--
-- O que ainda não aconteceu é rodar via `supabase test db` num banco
-- descartável, e com isso virar gate de CI. Isso depende de `supabase db
-- start` conseguir replicar as 213 migrations num Postgres limpo — a lacuna
-- nº 1 anotada no cabeçalho de .github/workflows/ci.yml, que é trabalho
-- próprio. Enquanto não for medido verde, não vira job: o mesmo arquivo de CI
-- é explícito em que gate que nasce vermelho vira ruído.
--
-- ---------------------------------------------------------------------------
-- Por que a fixture troca de identidade o tempo todo
--
-- enforce_customer_ticket_immutability descarta em silêncio qualquer mudança
-- fora da lista branca (status, updated_at) quando auth.uid() é o dono do
-- chamado e ele não é equipe interna. Um teste que montasse o cenário já
-- autenticado como o cliente veria os UPDATE de metadata e closed_at sumirem
-- sem erro, e os casos 4, 5 e 6 passariam pelo motivo errado — o mais
-- perigoso dos falsos verdes, porque a suíte fica verde justamente quando
-- para de testar.
--
-- Por isso: montagem do cenário SEM sessão (auth.uid() nulo, caminho de
-- service_role, que o trigger libera de propósito), e sessão de cliente só no
-- instante de perguntar o resultado, via pg_temp.pendente().
--
-- ---------------------------------------------------------------------------
-- Por que nenhum cenário volta para 'closed' por UPDATE
--
-- track_ticket_close_cancel faz closed_at := now() em toda transição que
-- ENTRA em 'closed'. Reaproveitar um chamado cancelado como "o antigo" o
-- tornaria o mais recente e inverteria o caso 8. Cada chamado nasce no estado
-- que o teste precisa; os UPDATE só mexem em metadata, closed_at e na saída
-- de 'closed' para 'cancelled'.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(9);

-- -----------------------------------------------------------------------------
-- Fixture
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE fixture (chave text PRIMARY KEY, valor uuid);

INSERT INTO fixture (chave, valor)
VALUES ('usuario', '11111111-1111-1111-1111-111111111111');

CREATE FUNCTION pg_temp.ref(k text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT valor FROM fixture WHERE chave = k $$;

-- Inserir em auth.users basta: um gatilho de cadastro cria o profile
-- correspondente e o associa à empresa padrão. Não se cria empresa aqui nem
-- se reatribui a do profile — validate_company_assignment recusa troca de
-- empresa fora de master admin, e forçar uma empresa própria só faria a
-- fixture brigar com uma regra que não é o objeto deste teste.
INSERT INTO auth.users (id, instance_id, email, aud, role)
VALUES (pg_temp.ref('usuario'), '00000000-0000-0000-0000-000000000000',
        'teste-avaliacao@orion.local', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO fixture (chave, valor)
SELECT 'empresa', company_id FROM public.profiles WHERE id = pg_temp.ref('usuario');

-- O usuário nasce sem papel em user_roles, ou seja, cliente comum. É o que o
-- teste quer: a regra isenta equipe interna, e uma fixture de técnico passaria
-- por todos os casos sem exercitar a regra.
SELECT ok(
  NOT public.is_equipe_interna(pg_temp.ref('usuario')),
  'a fixture e um cliente comum, nao equipe interna'
);

-- Liga e desliga a sessão do cliente. Nenhuma destas funções leva cláusula
-- SET: o set_config precisa valer depois que a função retorna, e uma cláusula
-- SET restauraria o valor na saída.
CREATE FUNCTION pg_temp.entrar() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', pg_temp.ref('usuario')::text)::text, true);
END $$;

CREATE FUNCTION pg_temp.sair() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

CREATE FUNCTION pg_temp.pendente() RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE v_resposta boolean;
BEGIN
  PERFORM pg_temp.entrar();
  v_resposta := public.tem_avaliacao_pendente();
  PERFORM pg_temp.sair();
  RETURN v_resposta;
END $$;

-- Cria um chamado encerrado há `dias_atras` dias e guarda o id na fixture.
--
-- A criação exige sessão: set_ticket_company_from_user ignora o company_id
-- informado e o deriva do profile de auth.uid(), recusando o INSERT quando não
-- há ninguém autenticado. A sessão é desligada logo em seguida, porque as
-- mutações dos cenários seguintes precisam escapar da lista branca de
-- enforce_customer_ticket_immutability.
CREATE FUNCTION pg_temp.criar_chamado(chave text, titulo text, dias_atras numeric, st text DEFAULT 'closed')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM pg_temp.entrar();

  -- aa_sanitiza_abertura_de_chamado faz o chamado do cliente nascer aberto;
  -- o encerramento vem depois, sem sessão, como o sistema faria.
  INSERT INTO public.tickets (user_id, company_id, requester_name, title, description,
                              category, priority)
  VALUES (pg_temp.ref('usuario'), pg_temp.ref('empresa'), 'Usuario de Teste', titulo,
          'Descricao longa o bastante para satisfazer a constraint de comprimento minimo do chamado.',
          'outros', 'medium')
  RETURNING id INTO v_id;

  PERFORM pg_temp.sair();

  UPDATE public.tickets SET status = st WHERE id = v_id;
  UPDATE public.tickets SET closed_at = now() - (dias_atras || ' days')::interval WHERE id = v_id;

  INSERT INTO fixture (chave, valor) VALUES (chave, v_id);
END $$;

-- -----------------------------------------------------------------------------
-- 1. Sem nada encerrado, nada bloqueia
-- -----------------------------------------------------------------------------
SELECT is( pg_temp.pendente(), false,
  'usuario sem chamado encerrado nao tem avaliacao pendente' );

-- -----------------------------------------------------------------------------
-- 2. Encerrado recente e sem avaliação bloqueia — o caso que dá razão à regra
-- -----------------------------------------------------------------------------
SELECT pg_temp.criar_chamado('alvo', 'sem avaliacao', 1);

SELECT is( pg_temp.pendente(), true,
  'chamado encerrado sem avaliacao bloqueia a abertura de um novo' );

-- -----------------------------------------------------------------------------
-- 3. Avaliado deixa de bloquear
-- -----------------------------------------------------------------------------
INSERT INTO public.ticket_ratings (ticket_id, user_id, rating)
VALUES (pg_temp.ref('alvo'), pg_temp.ref('usuario'), 5);

SELECT is( pg_temp.pendente(), false,
  'chamado avaliado libera a abertura' );

DELETE FROM public.ticket_ratings WHERE ticket_id = pg_temp.ref('alvo');

-- -----------------------------------------------------------------------------
-- 4. Chamado mesclado não é cobrado
-- -----------------------------------------------------------------------------
-- O cliente seria obrigado a avaliar um duplicado que talvez nem reconheça.
UPDATE public.tickets
   SET metadata = jsonb_build_object('merged_into', gen_random_uuid()::text)
 WHERE id = pg_temp.ref('alvo');

SELECT is( pg_temp.pendente(), false,
  'chamado mesclado em outro nao e cobrado' );

-- -----------------------------------------------------------------------------
-- 5. Fechado por inatividade não prende o cliente
-- -----------------------------------------------------------------------------
-- Sem esta exclusão a regra vira um laço: o cliente ignora o chamado, ele
-- fecha sozinho, e agora ele não abre chamado novo enquanto não avaliar o
-- atendimento que ele mesmo abandonou.
UPDATE public.tickets
   SET metadata = jsonb_build_object('fechado_por_inatividade', true)
 WHERE id = pg_temp.ref('alvo');

SELECT is( pg_temp.pendente(), false,
  'chamado fechado por inatividade nao prende o cliente' );

-- -----------------------------------------------------------------------------
-- 6. Passados 30 dias, a cobrança prescreve
-- -----------------------------------------------------------------------------
UPDATE public.tickets
   SET metadata = '{}'::jsonb, closed_at = now() - interval '31 days'
 WHERE id = pg_temp.ref('alvo');

SELECT is( pg_temp.pendente(), false,
  'chamado encerrado ha mais de 30 dias nao bloqueia mais' );

-- -----------------------------------------------------------------------------
-- 7. Chamado cancelado não conta
-- -----------------------------------------------------------------------------
-- Não houve atendimento a avaliar.
UPDATE public.tickets
   SET closed_at = now() - interval '1 day', status = 'cancelled'
 WHERE id = pg_temp.ref('alvo');

SELECT is( pg_temp.pendente(), false,
  'chamado cancelado nao gera cobranca de avaliacao' );

-- -----------------------------------------------------------------------------
-- 8. Só o ÚLTIMO encerrado importa
-- -----------------------------------------------------------------------------
-- Um chamado antigo sem avaliação não pode ressuscitar a cobrança quando o
-- mais recente já foi avaliado. É o ramo mais fácil de perder numa reescrita
-- da consulta, porque some junto com o LIMIT 1.
SELECT pg_temp.criar_chamado('antigo', 'antigo sem avaliacao', 5);
SELECT pg_temp.criar_chamado('recente', 'recente avaliado', 0.04);

INSERT INTO public.ticket_ratings (ticket_id, user_id, rating)
VALUES (pg_temp.ref('recente'), pg_temp.ref('usuario'), 4);

SELECT is( pg_temp.pendente(), false,
  'antigo sem avaliacao nao bloqueia quando o ultimo encerrado ja foi avaliado' );

SELECT * FROM finish();

ROLLBACK;
