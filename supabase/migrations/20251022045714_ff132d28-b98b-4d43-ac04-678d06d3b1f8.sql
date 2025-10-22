
-- Adicionar política RLS para técnicos master (Orion System)
-- Permite que técnicos da empresa Orion System atualizem tickets de qualquer empresa

CREATE POLICY "Master technicians can update all tickets"
ON public.tickets
FOR UPDATE
USING (
  has_role(auth.uid(), 'technician'::app_role) 
  AND is_master_company_user(auth.uid())
);
