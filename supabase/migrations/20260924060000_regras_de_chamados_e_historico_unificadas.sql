-- Advisor do Supabase (multiple_permissive_policies), continuação de
-- 20260924050000. Cada operação vira uma policy só, com o OR das antigas; o
-- acesso não muda.
--
-- tickets UPDATE (6 policies) e DELETE (3):
-- - "admin de empresa cliente na própria empresa" + "admin da empresa mãe em
--   tudo" = admin AND (empresa mãe OR mesma empresa); o mesmo para técnico.
-- - a reabertura pelo cliente mantém USING e WITH CHECK próprios (só sai de
--   closed/resolved e só vai para reopened).
--
-- ticket_status_history: 5 policies de SELECT + uma ALL de developer que
-- também valia para SELECT. A ALL vira INSERT/UPDATE/DELETE de developer e o
-- developer entra na policy única de SELECT.

-- tickets -----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins update company tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customers can reopen own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Developers update all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Master admins update all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Master technicians update all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Technicians update company tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins delete company tickets" ON public.tickets;
DROP POLICY IF EXISTS "Developers delete all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Master admins delete all tickets" ON public.tickets;

CREATE POLICY tickets_update ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR (
      ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
       OR (SELECT public.has_role((SELECT auth.uid()), 'technician'::public.app_role)))
      AND ((SELECT public.is_master_company_user((SELECT auth.uid())))
           OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))))
    OR (user_id = (SELECT auth.uid()) AND status = ANY (ARRAY['closed'::text, 'resolved'::text]))
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR (
      ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
       OR (SELECT public.has_role((SELECT auth.uid()), 'technician'::public.app_role)))
      AND ((SELECT public.is_master_company_user((SELECT auth.uid())))
           OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))))
    OR (user_id = (SELECT auth.uid()) AND status = 'reopened'::text)
  );

CREATE POLICY tickets_delete ON public.tickets
  FOR DELETE TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      AND ((SELECT public.is_master_company_user((SELECT auth.uid())))
           OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))))
  );

-- ticket_status_history ----------------------------------------------------
DROP POLICY IF EXISTS "Developers can manage all status history" ON public.ticket_status_history;
DROP POLICY IF EXISTS "Admins can view company status history" ON public.ticket_status_history;
DROP POLICY IF EXISTS "Customers can view own ticket status history" ON public.ticket_status_history;
DROP POLICY IF EXISTS "Master admins can view all status history" ON public.ticket_status_history;
DROP POLICY IF EXISTS "Master technicians can view all status history" ON public.ticket_status_history;
DROP POLICY IF EXISTS "Technicians can view company status history" ON public.ticket_status_history;

CREATE POLICY ticket_status_history_select ON public.ticket_status_history
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR (
      ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
       OR (SELECT public.has_role((SELECT auth.uid()), 'technician'::public.app_role)))
      AND ((SELECT public.is_master_company_user((SELECT auth.uid())))
           OR public.get_ticket_company_id(ticket_id) = (SELECT public.get_user_company_id((SELECT auth.uid())))))
    OR EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = ticket_status_history.ticket_id
         AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ticket_status_history_developer_insert ON public.ticket_status_history
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role)));

CREATE POLICY ticket_status_history_developer_update ON public.ticket_status_history
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role)));

CREATE POLICY ticket_status_history_developer_delete ON public.ticket_status_history
  FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role)));
