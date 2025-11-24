-- Criar tabela de respostas prontas (canned responses/macros)
CREATE TABLE public.canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, shortcut)
);

-- Habilitar RLS
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Técnicos e admins podem visualizar respostas da própria empresa
CREATE POLICY "Technicians and admins can view company canned responses"
ON public.canned_responses
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);

-- Técnicos e admins podem criar respostas na própria empresa
CREATE POLICY "Technicians and admins can create company canned responses"
ON public.canned_responses
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND company_id = get_user_company_id(auth.uid())
  AND created_by = auth.uid()
);

-- Técnicos e admins podem atualizar respostas da própria empresa
CREATE POLICY "Technicians and admins can update company canned responses"
ON public.canned_responses
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);

-- Técnicos e admins podem deletar respostas da própria empresa
CREATE POLICY "Technicians and admins can delete company canned responses"
ON public.canned_responses
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);

-- Developers podem fazer tudo
CREATE POLICY "Developers can manage all canned responses"
ON public.canned_responses
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_canned_responses_updated_at
BEFORE UPDATE ON public.canned_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para melhor performance
CREATE INDEX idx_canned_responses_company_id ON public.canned_responses(company_id);
CREATE INDEX idx_canned_responses_shortcut ON public.canned_responses(company_id, shortcut);