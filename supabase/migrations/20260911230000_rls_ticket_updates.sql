-- =================================================================================
-- Migration: 20260911230000_rls_ticket_updates.sql
--
-- Quinto e maior lote dos achados P2 de RLS: 17 políticas viram 4.
-- ticket_updates é a timeline visível dos chamados e dispara
-- create_notification_on_ticket_update, então errar aqui é visível na tela.
--
-- Diferente de user_roles, aqui nenhuma política tinha USING e WITH CHECK
-- divergentes — foi a primeira coisa verificada, depois da armadilha do lote
-- anterior.
--
-- ---------------------------------------------------------------------------
-- A simplificação que a estrutura permitia
--
-- As políticas "Company admins ..." traziam "NOT is_master_company_user(...)",
-- tornando-as mutuamente exclusivas com as "Master admins ..." — uma partição
-- deliberada, não sobreposição. A união das duas colapsa:
--
--   (admin AND NOT master AND mesma_empresa) OR (admin AND master)
--     =  admin AND (master OR mesma_empresa)
--
-- Technicians seguiam o mesmo desenho, sem o NOT. Resultado: admin e
-- technician compartilham exatamente a mesma condição, e viram um termo só.
--
-- ---------------------------------------------------------------------------
-- Duas travas preservadas de propósito
--
-- 1. Janela de edição de 15 minutos: autor pode editar o próprio comentário
--    só enquanto recente. Medida com um comentário criado na hora.
--
-- 2. author_id = auth.uid() OR author_id IS NULL, no INSERT. Esta é
--    redundante na prática: set_ticket_update_author (BEFORE INSERT) já
--    sobrescreve author_id com auth.uid(), e foi verificado que um INSERT
--    enviando o id de outra pessoa grava o id de quem chamou
--    (author_id enviado c0cd9ca4..., gravado 6c7e0cb0...). Mantida mesmo
--    assim: se o trigger sair um dia, a política continua barrando.
--
-- ---------------------------------------------------------------------------
-- Paridade medida antes de aplicar — 17 cenários, todos idênticos:
--
--   SELECT   Samuel Terres 22, Tecnico 22, Guilherme 22,
--            usuario 12, samuel (SAMUEL) 8   (cliente só vê os próprios
--                                             chamados e nada is_internal)
--   UPDATE   só developer (22); demais 0, porque as linhas existentes já
--            estão fora da janela de 15 minutos
--   DELETE   developer e admins 22; technician e clientes 0
--   Janela   autor edita o próprio comentário recém-criado: 1 linha
-- =================================================================================

DROP POLICY IF EXISTS "Company admins can view company ticket updates"        ON public.ticket_updates;
DROP POLICY IF EXISTS "Company technicians can view company ticket updates"   ON public.ticket_updates;
DROP POLICY IF EXISTS "Developers can view all ticket updates"                ON public.ticket_updates;
DROP POLICY IF EXISTS "Master admins can view all ticket updates"             ON public.ticket_updates;
DROP POLICY IF EXISTS "Master technicians can view all ticket updates"        ON public.ticket_updates;
DROP POLICY IF EXISTS "Users can view updates for their tickets"              ON public.ticket_updates;
DROP POLICY IF EXISTS "Company admins can create company ticket updates"      ON public.ticket_updates;
DROP POLICY IF EXISTS "Company technicians can create company ticket updates" ON public.ticket_updates;
DROP POLICY IF EXISTS "Developers can create ticket updates"                  ON public.ticket_updates;
DROP POLICY IF EXISTS "Master admins can create all ticket updates"           ON public.ticket_updates;
DROP POLICY IF EXISTS "Master technicians can create all ticket updates"      ON public.ticket_updates;
DROP POLICY IF EXISTS "Users can create updates for their tickets"            ON public.ticket_updates;
DROP POLICY IF EXISTS "Authors can edit recent updates"                       ON public.ticket_updates;
DROP POLICY IF EXISTS "Developers can update any update"                      ON public.ticket_updates;
DROP POLICY IF EXISTS "Company admins can delete company ticket updates"      ON public.ticket_updates;
DROP POLICY IF EXISTS "Developers can delete any update"                      ON public.ticket_updates;
DROP POLICY IF EXISTS "Master admins can delete all ticket updates"           ON public.ticket_updates;

-- Equipe vê a timeline da própria empresa (ou toda, se MSP). O dono do
-- chamado vê a sua, menos o que for interno.
CREATE POLICY "ticket_updates_select" ON public.ticket_updates
  FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR ((has_role((select auth.uid()), 'admin'::app_role)
         OR has_role((select auth.uid()), 'technician'::app_role))
        AND (is_master_company_user((select auth.uid()))
             OR ticket_belongs_to_user_company(ticket_id, (select auth.uid()))))
    OR (is_internal = false
        AND EXISTS (SELECT 1 FROM public.tickets t
                    WHERE t.id = ticket_updates.ticket_id
                      AND t.user_id = (select auth.uid())))
  );

CREATE POLICY "ticket_updates_insert" ON public.ticket_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    (author_id = (select auth.uid()) OR author_id IS NULL)
    AND (
      has_role((select auth.uid()), 'developer'::app_role)
      OR ((has_role((select auth.uid()), 'admin'::app_role)
           OR has_role((select auth.uid()), 'technician'::app_role))
          AND (is_master_company_user((select auth.uid()))
               OR ticket_belongs_to_user_company(ticket_id, (select auth.uid()))))
      OR EXISTS (SELECT 1 FROM public.tickets t
                 WHERE t.id = ticket_updates.ticket_id
                   AND t.user_id = (select auth.uid()))
    )
  );

-- Janela de 15 minutos para o autor corrigir o que escreveu.
CREATE POLICY "ticket_updates_update" ON public.ticket_updates
  FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (author_id = (select auth.uid())
        AND created_at > now() - interval '15 minutes')
  );

-- Apagar timeline é privilégio de admin; technician não apaga.
CREATE POLICY "ticket_updates_delete" ON public.ticket_updates
  FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'developer'::app_role)
    OR (has_role((select auth.uid()), 'admin'::app_role)
        AND (is_master_company_user((select auth.uid()))
             OR ticket_belongs_to_user_company(ticket_id, (select auth.uid()))))
  );
