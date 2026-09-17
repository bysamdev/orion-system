-- =============================================================================
-- Regra de avaliação obrigatória — cobertura automatizada
-- =============================================================================
--
-- Rode com:  supabase test db
--
-- A regra saiu do TypeScript (onde tinha 13 testes) e virou função SQL em
-- 20260916230000_avaliacao_obrigatoria.sql. A função é fonte única: a policy
-- de INSERT de tickets e o frontend, via RPC, leem os dois da mesma lógica.
-- Como ela decide se alguém consegue ou não abrir chamado, cada ramo precisa
-- de um teste — é uma regra fácil de endurecer sem querer e o sintoma é um
-- cliente travado.
--
-- Os sete cenários abaixo foram validados contra o banco de produção em
-- 17/09/2026, dentro de uma transação desfeita, antes deste arquivo existir.
-- Todos passaram. Este arquivo transforma aquela verificação manual em gate.
--
-- ATENÇÃO: este arquivo ainda NÃO foi executado. Escrever ele exigiu só o
-- schema; rodar exige Docker (supabase db start), que não existia na máquina
-- onde foi escrito. Antes de ligar como gate de CI, rode uma vez localmente e
-- corrija o que a fixture pedir — a parte frágil é o cadastro do usuário de
-- teste, que depende de quais gatilhos de auth/profiles disparam no stack
-- local. A lógica testada é que está confirmada.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(7);

-- -----------------------------------------------------------------------------
-- Fixture
-- -----------------------------------------------------------------------------
-- Um usuário, uma empresa, e o cliente "logado" como esse usuário.
-- tem_avaliacao_pendente() lê auth.uid(), que por sua vez lê o claim `sub`.

CREATE TEMP TABLE ids AS
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid AS usuario,
  '22222222-2222-2222-2222-222222222222'::uuid AS empresa;

INSERT INTO public.companies (id, name)
SELECT empresa, 'Empresa de Teste' FROM ids;

INSERT INTO auth.users (id, email, instance_id, aud, role)
SELECT usuario, 'teste-avaliacao@orion.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
FROM ids
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, company_id, full_name, email)
SELECT usuario, empresa, 'Usuario de Teste', 'teste-avaliacao@orion.local' FROM ids
ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', (SELECT usuario::text FROM ids))::text,
  true
);

-- Helper: cria um chamado encerrado há `dias_atras` dias e devolve o id.
CREATE FUNCTION pg_temp.chamado_encerrado(titulo text, dias_atras numeric, meta jsonb DEFAULT '{}'::jsonb, st text DEFAULT 'closed')
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.tickets (user_id, company_id, requester_name, title, description, category, priority, status, closed_at, metadata)
  SELECT usuario, empresa, 'Usuario de Teste', titulo,
         'Descricao longa o bastante para satisfazer a constraint de comprimento minimo do chamado.',
         'outros', 'medium', st, now() - (dias_atras || ' days')::interval, meta
  FROM ids
  RETURNING id;
$$;

-- -----------------------------------------------------------------------------
-- 1. Sem nada encerrado, nada bloqueia
-- -----------------------------------------------------------------------------
SELECT is(
  public.tem_avaliacao_pendente(),
  false,
  'usuario sem chamado encerrado nao tem avaliacao pendente'
);

-- -----------------------------------------------------------------------------
-- 2. Encerrado recente e sem avaliação bloqueia — o caso que dá razão à regra
-- -----------------------------------------------------------------------------
SELECT pg_temp.chamado_encerrado('sem avaliacao', 1) AS id \gset alvo_
SELECT is(
  public.tem_avaliacao_pendente(),
  true,
  'chamado encerrado sem avaliacao bloqueia a abertura de um novo'
);

-- -----------------------------------------------------------------------------
-- 3. Avaliado deixa de bloquear
-- -----------------------------------------------------------------------------
INSERT INTO public.ticket_ratings (ticket_id, user_id, rating)
SELECT :'alvo_id', usuario, 5 FROM ids;

SELECT is(
  public.tem_avaliacao_pendente(),
  false,
  'chamado avaliado libera a abertura'
);

DELETE FROM public.ticket_ratings WHERE ticket_id = :'alvo_id';

-- -----------------------------------------------------------------------------
-- 4. Chamado mesclado não é cobrado
-- -----------------------------------------------------------------------------
-- O cliente seria obrigado a avaliar um duplicado que talvez nem reconheça.
UPDATE public.tickets
   SET metadata = jsonb_build_object('merged_into', gen_random_uuid()::text)
 WHERE id = :'alvo_id';

SELECT is(
  public.tem_avaliacao_pendente(),
  false,
  'chamado mesclado em outro nao e cobrado'
);

-- -----------------------------------------------------------------------------
-- 5. Fechado por inatividade não é cobrado
-- -----------------------------------------------------------------------------
-- Sem esta exclusão a regra vira um laço: o cliente ignora o chamado, ele
-- fecha sozinho, e agora ele não abre chamado novo enquanto não avaliar o
-- atendimento que ele mesmo abandonou.
UPDATE public.tickets
   SET metadata = jsonb_build_object('fechado_por_inatividade', true)
 WHERE id = :'alvo_id';

SELECT is(
  public.tem_avaliacao_pendente(),
  false,
  'chamado fechado por inatividade nao prende o cliente'
);

-- -----------------------------------------------------------------------------
-- 6. Passados 30 dias, a cobrança prescreve
-- -----------------------------------------------------------------------------
UPDATE public.tickets
   SET metadata = '{}'::jsonb, closed_at = now() - interval '31 days'
 WHERE id = :'alvo_id';

SELECT is(
  public.tem_avaliacao_pendente(),
  false,
  'chamado encerrado ha mais de 30 dias nao bloqueia mais'
);

-- -----------------------------------------------------------------------------
-- 7. Só o ÚLTIMO encerrado importa
-- -----------------------------------------------------------------------------
-- Um chamado antigo sem avaliação não pode ressuscitar a cobrança quando o
-- mais recente já foi avaliado. Este é o ramo mais fácil de quebrar numa
-- reescrita da consulta, porque some se o LIMIT 1 for perdido.
UPDATE public.tickets
   SET closed_at = now() - interval '5 days'
 WHERE id = :'alvo_id';

SELECT pg_temp.chamado_encerrado('mais recente', 0.04) AS id \gset recente_

INSERT INTO public.ticket_ratings (ticket_id, user_id, rating)
SELECT :'recente_id', usuario, 4 FROM ids;

SELECT is(
  public.tem_avaliacao_pendente(),
  false,
  'antigo sem avaliacao nao bloqueia quando o ultimo encerrado ja foi avaliado'
);

SELECT * FROM finish();

ROLLBACK;
