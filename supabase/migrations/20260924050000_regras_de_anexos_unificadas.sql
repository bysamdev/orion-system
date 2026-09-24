-- Advisor do Supabase (multiple_permissive_policies): ticket_attachments tinha
-- 6 policies de SELECT, 6 de INSERT e 3 de DELETE, todas permissivas. O
-- Postgres avalia todas em cada linha. Aqui cada operação vira uma policy só,
-- com o OR das antigas, e o acesso não muda.
--
-- Simplificações que não mudam o resultado:
-- - developer e admin da empresa mãe já são is_equipe_interna, então as
--   policies próprias deles somem dentro dela (SELECT e INSERT);
-- - o "NOT is_master_company_user" da policy de admin de empresa cliente era
--   redundante: o admin da empresa mãe já via tudo por outra policy.
-- DELETE continua sem o técnico da empresa mãe, como antes.

DROP POLICY IF EXISTS "Admins can view company ticket attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Customers can view own ticket attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Developers can view all attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Equipe interna ve todos os anexos" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Master admins can view all attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Technicians can view company ticket attachments" ON public.ticket_attachments;

DROP POLICY IF EXISTS "Admins can create company ticket attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Customers can create own ticket attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Developers can create attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Equipe interna anexa em qualquer chamado" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Master admins can create all attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Technicians can create company ticket attachments" ON public.ticket_attachments;

DROP POLICY IF EXISTS "Admins can delete company ticket attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Developers can delete all attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Master admins can delete all attachments" ON public.ticket_attachments;

CREATE POLICY ticket_attachments_select ON public.ticket_attachments
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_equipe_interna((SELECT auth.uid())))
    OR (
      ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
       OR (SELECT public.has_role((SELECT auth.uid()), 'technician'::public.app_role)))
      AND public.ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = ticket_attachments.ticket_id
         AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ticket_attachments_insert ON public.ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND (
      (SELECT public.is_equipe_interna((SELECT auth.uid())))
      OR (
        ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
         OR (SELECT public.has_role((SELECT auth.uid()), 'technician'::public.app_role)))
        AND public.ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
      )
      OR EXISTS (
        SELECT 1 FROM public.tickets t
         WHERE t.id = ticket_attachments.ticket_id
           AND t.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY ticket_attachments_delete ON public.ticket_attachments
  FOR DELETE TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'developer'::public.app_role))
    OR (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      AND (
        (SELECT public.is_master_company_user((SELECT auth.uid())))
        OR public.ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
      )
    )
  );
