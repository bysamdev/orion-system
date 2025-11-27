-- Remover política antiga insegura
DROP POLICY IF EXISTS "Authenticated users can upload ticket files" ON storage.objects;

-- Criar nova política segura (exige que o caminho do arquivo comece com o ticket_id)
CREATE POLICY "Users can upload to their tickets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-files' AND
  (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id::text = split_part(name, '/', 1)
      AND (
        t.user_id = auth.uid()
        OR (has_role(auth.uid(), 'technician'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid()))
        OR (has_role(auth.uid(), 'admin'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid()))
        OR (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
        OR has_role(auth.uid(), 'developer'::app_role)
      )
    )
  )
);