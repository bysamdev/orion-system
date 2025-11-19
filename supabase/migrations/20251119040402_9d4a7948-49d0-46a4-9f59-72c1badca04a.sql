-- Permitir que customers reabram seus próprios tickets fechados/resolvidos
CREATE POLICY "Customers can reopen their own closed tickets"
ON tickets FOR UPDATE
USING (
  user_id = auth.uid() 
  AND status IN ('closed', 'resolved')
)
WITH CHECK (
  user_id = auth.uid() 
  AND status = 'reopened'
);