-- ORN-SEC-22: admin e técnico de empresa CLIENTE liam as notas internas da
-- equipe (ticket_updates.is_internal = true) nos chamados da empresa deles.
-- Decisão de 23/09/2026: nota interna é só da equipe interna (empresa mãe e
-- developer, is_equipe_interna). Admin e técnico de empresa cliente continuam
-- vendo as atualizações públicas dos chamados da empresa; o dono do chamado
-- continua vendo as públicas do próprio chamado.

DROP POLICY IF EXISTS ticket_updates_select ON public.ticket_updates;
CREATE POLICY ticket_updates_select ON public.ticket_updates
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_equipe_interna((SELECT auth.uid())))
    OR (
      is_internal = false
      AND (
        (
          ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
           OR (SELECT public.has_role((SELECT auth.uid()), 'technician'::public.app_role)))
          AND public.ticket_belongs_to_user_company(ticket_id, (SELECT auth.uid()))
        )
        OR EXISTS (
          SELECT 1 FROM public.tickets t
           WHERE t.id = ticket_updates.ticket_id
             AND t.user_id = (SELECT auth.uid())
        )
      )
    )
  );
