-- Adicionar coluna is_internal na tabela ticket_updates
ALTER TABLE public.ticket_updates 
ADD COLUMN is_internal boolean NOT NULL DEFAULT false;

-- Remover políticas de SELECT existentes que precisam ser atualizadas
DROP POLICY IF EXISTS "Users can view updates for their tickets" ON public.ticket_updates;
DROP POLICY IF EXISTS "Company admins can view company ticket updates" ON public.ticket_updates;
DROP POLICY IF EXISTS "Company technicians can view company ticket updates" ON public.ticket_updates;
DROP POLICY IF EXISTS "Master admins can view all ticket updates" ON public.ticket_updates;
DROP POLICY IF EXISTS "Developers can view all ticket updates" ON public.ticket_updates;

-- Recriar política para clientes - NÃO podem ver notas internas
CREATE POLICY "Users can view updates for their tickets"
ON public.ticket_updates
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_updates.ticket_id 
    AND tickets.user_id = auth.uid()
  ))
  AND is_internal = false
);

-- Técnicos podem ver todas as atualizações (incluindo internas) da empresa
CREATE POLICY "Company technicians can view company ticket updates"
ON public.ticket_updates
FOR SELECT
USING (
  has_role(auth.uid(), 'technician'::app_role) 
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);

-- Admins da empresa podem ver todas as atualizações (incluindo internas)
CREATE POLICY "Company admins can view company ticket updates"
ON public.ticket_updates
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND (NOT is_master_company_user(auth.uid())) 
  AND ticket_belongs_to_user_company(ticket_id, auth.uid())
);

-- Master admins podem ver todas as atualizações
CREATE POLICY "Master admins can view all ticket updates"
ON public.ticket_updates
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_master_company_user(auth.uid())
);

-- Developers podem ver todas as atualizações
CREATE POLICY "Developers can view all ticket updates"
ON public.ticket_updates
FOR SELECT
USING (has_role(auth.uid(), 'developer'::app_role));

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.ticket_updates.is_internal IS 'Indica se é uma nota interna visível apenas para técnicos e admins';