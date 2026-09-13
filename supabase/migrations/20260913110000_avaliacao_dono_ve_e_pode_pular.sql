-- =================================================================================
-- Migration: 20260913110000_avaliacao_dono_ve_e_pode_pular.sql
--
-- Pré-requisito bloqueante da fase 3 (avaliação obrigatória antes de novo
-- chamado): o dono do chamado passa a enxergar a própria avaliação, e passa a
-- existir uma forma auditável de pular.
--
-- ---------------------------------------------------------------------------
-- 1. O dono não via a própria avaliação — e o efeito era pior que "não via"
--
-- ticket_ratings tinha duas policies: INSERT para o dono do chamado, SELECT só
-- para equipe interna e staff da empresa. Confirmado o achado da auditoria de
-- 2026-09-04, e medido impersonando o customer dono do #1173:
--
--   INSERT simples ................................. PODE (a linha é gravada)
--   SELECT da própria avaliação .................... 0 linhas
--   INSERT .. RETURNING ............................ ERRO 42501
--
-- Contraprova com o Tecnico, que tem policy de SELECT, mesmo código:
-- INSERT PODE / SELECT vê 1 / RETURNING devolveu 1. A falha é atribuível à
-- ausência do SELECT, não ao WITH CHECK.
--
-- O terceiro caso é o que quebra a tela: useTicketRating faz
-- .insert().select().single(), que é exatamente INSERT .. RETURNING. O cliente
-- gravava a avaliação e recebia "Não foi possível registrar sua avaliação".
-- Tentando de novo, gravava outra — não havia UNIQUE em ticket_id.
--
-- É a origem do UX-020 (formulário de avaliação eterno) e seria também o
-- cenário em que o bloqueio da fase 3 trancaria o cliente para sempre: a
-- avaliação existe no banco, o front nunca a vê, e ele nunca mais abre
-- chamado. Por isso esta migration vem antes de qualquer lógica de bloqueio.
--
-- As duas policies de SELECT viram uma só, em vez de somar uma segunda — o
-- padrão dos lotes de RLS de 2026-09-11. A condição nova é exatamente "o
-- chamado é meu", sem alargar nada além disso.
--
-- ---------------------------------------------------------------------------
-- 2. Pular a avaliação
--
-- skipped separa "pulou" de "não respondeu". Sem essa distinção a métrica de
-- satisfação mente: quem pulou vira indistinguível de quem nunca viu o
-- formulário.
--
-- rating passa a aceitar NULL, e um CHECK amarra os dois campos: ou é uma
-- avaliação de verdade (1..5, skipped = false), ou é um pulo (rating NULL,
-- skipped = true). Não existe linha "pulou com nota 4".
--
-- A tabela tem 0 linhas hoje, então tornar rating anulável, trocar o CHECK e
-- criar o UNIQUE não precisa de backfill nem de janela.
-- =================================================================================

ALTER TABLE public.ticket_ratings
  ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false;

ALTER TABLE public.ticket_ratings
  ALTER COLUMN rating DROP NOT NULL;

ALTER TABLE public.ticket_ratings
  DROP CONSTRAINT IF EXISTS ticket_ratings_rating_check;

ALTER TABLE public.ticket_ratings
  ADD CONSTRAINT ticket_ratings_nota_ou_pulo CHECK (
    (skipped = true  AND rating IS NULL)
    OR
    (skipped = false AND rating BETWEEN 1 AND 5)
  );

-- Uma avaliação por chamado. Também é o índice que a consulta de pendência usa.
CREATE UNIQUE INDEX IF NOT EXISTS ticket_ratings_ticket_id_key
  ON public.ticket_ratings (ticket_id);

-- ---------------------------------------------------------------------------
-- SELECT consolidado: equipe (como antes) OR dono do chamado (novo).
DROP POLICY IF EXISTS "Equipe interna e staff da empresa veem avaliacoes" ON public.ticket_ratings;
DROP POLICY IF EXISTS "ticket_ratings_select"                             ON public.ticket_ratings;

CREATE POLICY "ticket_ratings_select" ON public.ticket_ratings
  FOR SELECT TO authenticated
  USING (
    is_equipe_interna((select auth.uid()))
    OR (ticket_belongs_to_user_company(ticket_id, (select auth.uid()))
        AND (has_role((select auth.uid()), 'admin'::app_role)
             OR has_role((select auth.uid()), 'technician'::app_role)))
    OR EXISTS (SELECT 1 FROM public.tickets t
               WHERE t.id = ticket_ratings.ticket_id
                 AND t.user_id = (select auth.uid()))
  );
