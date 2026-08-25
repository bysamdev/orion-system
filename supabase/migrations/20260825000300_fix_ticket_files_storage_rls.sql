-- =================================================================================
-- Migration: 20260825000300_fix_ticket_files_storage_rls.sql
-- Descrição: Corrige BOLA/IDOR no bucket de storage ticket-files.
--
-- Bugs corrigidos:
-- 1. SELECT usava `ta.file_url LIKE '%' || storage.objects.name || '%'`.
--    file_url guarda o path bruto do storage (ex.: "<ticketId>/169234-x.png",
--    ver src/hooks/useTicketAttachments.ts linha ~130), então o match
--    deveria ser igualdade estrita -- com LIKE, um nome de arquivo comum
--    (ex.: "1.png") dava match como substring do path de anexos de
--    QUALQUER outro chamado de QUALQUER outra empresa.
-- 2. INSERT só checava bucket_id = 'ticket-files', sem validar que o
--    primeiro segmento do path (o ticket_id) é um chamado que o usuário
--    tem permissão de anexar -- qualquer autenticado podia subir arquivo
--    na pasta de qualquer ticket_id, mesmo de outra empresa.
-- =================================================================================

DROP POLICY IF EXISTS "Users can view ticket files they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload ticket files" ON storage.objects;

CREATE POLICY "Users can view ticket files they have access to"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-files' AND
  EXISTS (
    SELECT 1 FROM ticket_attachments ta
    JOIN tickets t ON t.id = ta.ticket_id
    WHERE ta.file_url = storage.objects.name
    AND (
      t.user_id = auth.uid() OR
      (has_role(auth.uid(), 'technician'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid())) OR
      (has_role(auth.uid(), 'admin'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid())) OR
      (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid())) OR
      has_role(auth.uid(), 'developer'::app_role)
    )
  )
);

CREATE POLICY "Users can upload files to tickets they have access to"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-files' AND
  EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id::text = (storage.foldername(storage.objects.name))[1]
    AND (
      t.user_id = auth.uid() OR
      (has_role(auth.uid(), 'technician'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid())) OR
      (has_role(auth.uid(), 'admin'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid())) OR
      (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid())) OR
      has_role(auth.uid(), 'developer'::app_role)
    )
  )
);
