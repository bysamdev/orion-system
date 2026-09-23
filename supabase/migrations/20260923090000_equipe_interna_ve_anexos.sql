-- ORN-BUG-12: técnico da empresa mãe não via nem anexava arquivos em
-- chamados de clientes. As policies de anexos só tinham o ramo "admin de
-- empresa mãe" (is_master_company_user + admin); técnico ficava preso à
-- própria empresa, ao contrário do resto do sistema, onde a equipe interna
-- vê todas as empresas.
--
-- Policies novas, somadas às existentes (permissivas), usando a mesma regra
-- de equipe interna do resto do banco (is_equipe_interna).

DROP POLICY IF EXISTS "Equipe interna ve todos os anexos" ON public.ticket_attachments;
CREATE POLICY "Equipe interna ve todos os anexos" ON public.ticket_attachments
  FOR SELECT TO authenticated
  USING (public.is_equipe_interna((SELECT auth.uid())));

DROP POLICY IF EXISTS "Equipe interna anexa em qualquer chamado" ON public.ticket_attachments;
CREATE POLICY "Equipe interna anexa em qualquer chamado" ON public.ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_equipe_interna((SELECT auth.uid()))
    AND uploaded_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Equipe interna le arquivos de chamado" ON storage.objects;
CREATE POLICY "Equipe interna le arquivos de chamado" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-files' AND public.is_equipe_interna((SELECT auth.uid())));

DROP POLICY IF EXISTS "Equipe interna envia arquivos de chamado" ON storage.objects;
CREATE POLICY "Equipe interna envia arquivos de chamado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-files' AND public.is_equipe_interna((SELECT auth.uid())));
