-- 1. Remover a política antiga que permitia edição por técnicos
DROP POLICY IF EXISTS "Admins and techs can manage company kb_articles" ON public.knowledge_base_articles;

-- 2. Criar política de gerenciamento apenas para administradores da mesma empresa
CREATE POLICY "Admins can manage company kb_articles" ON public.knowledge_base_articles FOR ALL
  TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND company_id = get_user_company_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    AND company_id = get_user_company_id(auth.uid())
  );

-- 3. Criar política para técnicos apenas visualizarem (qualquer status/visibilidade, desde que da mesma empresa)
CREATE POLICY "Techs can view company kb_articles" ON public.knowledge_base_articles FOR SELECT
  TO authenticated USING (
    has_role(auth.uid(), 'technician'::app_role) 
    AND company_id = get_user_company_id(auth.uid())
  );
