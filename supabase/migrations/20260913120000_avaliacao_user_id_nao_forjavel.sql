-- =================================================================================
-- Migration: 20260913120000_avaliacao_user_id_nao_forjavel.sql
--
-- Folga notada ao testar a migration anterior, não listada em nenhum relatório.
--
-- A policy de INSERT de ticket_ratings validava só que o CHAMADO era de quem
-- chamava. A coluna user_id, que é quem assina a avaliação, vinha do cliente e
-- não era conferida — useTicketRating a envia explicitamente. Um cliente podia
-- avaliar o próprio chamado assinando com o id de outra pessoa.
--
-- Não é escalonamento de privilégio: a pessoa só consegue fazer isso em
-- chamados dela. Mas contamina a métrica de satisfação e o histórico de quem
-- avaliou o quê, que é justamente o dado que a fase 3 passa a usar para
-- decidir se alguém pode abrir chamado.
--
-- Duas mudanças pequenas:
--   - DEFAULT auth.uid(), para o cliente poder simplesmente omitir a coluna
--   - user_id = auth.uid() no WITH CHECK, para quando não omitir
--
-- Medido, impersonando o customer dono do #1173:
--   forjar user_id de outro ........................ BLOQUEADO 42501
--   omitir user_id ................................. gravou com o próprio uid
-- =================================================================================

ALTER TABLE public.ticket_ratings ALTER COLUMN user_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Users can rate their own tickets" ON public.ticket_ratings;
DROP POLICY IF EXISTS "ticket_ratings_insert"            ON public.ticket_ratings;

CREATE POLICY "ticket_ratings_insert" ON public.ticket_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.tickets t
                WHERE t.id = ticket_ratings.ticket_id
                  AND t.user_id = (select auth.uid()))
  );
