-- Criar tabela de anexos de tickets
CREATE TABLE public.ticket_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ticket_attachments
-- Customers podem ver anexos dos seus próprios tickets
CREATE POLICY "Customers can view own ticket attachments"
ON public.ticket_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t 
    WHERE t.id = ticket_attachments.ticket_id 
    AND t.user_id = auth.uid()
  )
);

-- Customers podem criar anexos nos seus próprios tickets
CREATE POLICY "Customers can create own ticket attachments"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM tickets t 
    WHERE t.id = ticket_attachments.ticket_id 
    AND t.user_id = auth.uid()
  )
);

-- Technicians podem ver anexos de tickets da empresa
CREATE POLICY "Technicians can view company ticket attachments"
ON public.ticket_attachments
FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role) AND
  ticket_belongs_to_user_company(ticket_id, auth.uid())
);

-- Technicians podem criar anexos em tickets da empresa
CREATE POLICY "Technicians can create company ticket attachments"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'technician'::app_role) AND
  uploaded_by = auth.uid() AND
  ticket_belongs_to_user_company(ticket_id, auth.uid())
);

-- Admins da empresa podem gerenciar anexos
CREATE POLICY "Admins can view company ticket attachments"
ON public.ticket_attachments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  (NOT is_master_company_user(auth.uid())) AND
  ticket_belongs_to_user_company(ticket_id, auth.uid())
);

CREATE POLICY "Admins can create company ticket attachments"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND
  uploaded_by = auth.uid() AND
  ticket_belongs_to_user_company(ticket_id, auth.uid())
);

CREATE POLICY "Admins can delete company ticket attachments"
ON public.ticket_attachments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  ticket_belongs_to_user_company(ticket_id, auth.uid())
);

-- Master admins podem ver/criar/deletar todos os anexos
CREATE POLICY "Master admins can view all attachments"
ON public.ticket_attachments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid())
);

CREATE POLICY "Master admins can create all attachments"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND
  is_master_company_user(auth.uid()) AND
  uploaded_by = auth.uid()
);

CREATE POLICY "Master admins can delete all attachments"
ON public.ticket_attachments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid())
);

-- Developers podem gerenciar todos os anexos
CREATE POLICY "Developers can view all attachments"
ON public.ticket_attachments
FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers can create attachments"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'developer'::app_role) AND
  uploaded_by = auth.uid()
);

CREATE POLICY "Developers can delete all attachments"
ON public.ticket_attachments
FOR DELETE
USING (has_role(auth.uid(), 'developer'::app_role));

-- Criar índice para performance
CREATE INDEX idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by);

-- Criar bucket de storage para arquivos de tickets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-files', 
  'ticket-files', 
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
);

-- Políticas de Storage RLS para o bucket ticket-files
-- Usuários autenticados podem fazer upload de arquivos
CREATE POLICY "Authenticated users can upload ticket files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-files');

-- Usuários podem ver arquivos de tickets que têm acesso
CREATE POLICY "Users can view ticket files they have access to"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-files' AND
  EXISTS (
    SELECT 1 FROM ticket_attachments ta
    JOIN tickets t ON t.id = ta.ticket_id
    WHERE ta.file_url LIKE '%' || storage.objects.name || '%'
    AND (
      t.user_id = auth.uid() OR
      (has_role(auth.uid(), 'technician'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid())) OR
      (has_role(auth.uid(), 'admin'::app_role) AND ticket_belongs_to_user_company(t.id, auth.uid())) OR
      (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid())) OR
      has_role(auth.uid(), 'developer'::app_role)
    )
  )
);

-- Admins/Developers podem deletar arquivos
CREATE POLICY "Admins can delete ticket files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-files' AND
  (
    (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid())) OR
    has_role(auth.uid(), 'developer'::app_role)
  )
);