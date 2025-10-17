-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number SERIAL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  operator_name TEXT,
  assigned_to TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket_updates table
CREATE TABLE IF NOT EXISTS public.ticket_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('created', 'status', 'assignment', 'comment')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket_id ON public.ticket_updates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_updates_created_at ON public.ticket_updates(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing public access for now - adjust based on auth requirements)
CREATE POLICY "Allow all access to tickets" ON public.tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ticket_updates" ON public.ticket_updates FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tickets
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.tickets (title, description, requester_name, category, priority, status, operator_name, assigned_to, department) VALUES
('Erro no sistema ERP', 'O sistema ERP está apresentando erro ao tentar salvar dados financeiros. Preciso de ajuda urgente.', 'Cleber Junior', 'ERP', 'high', 'open', 'Marcos Almeida', 'Marcos Almeida', 'TI'),
('Problema com E-mail', 'Não consigo enviar e-mails desde esta manhã. Aparece erro de autenticação.', 'Roberto Mariano', 'E-mail', 'high', 'open', 'Marcos Almeida', 'Marcos Almeida', 'TI'),
('Computador não liga', 'Meu computador não está ligando. Tentei verificar os cabos mas não resolveu.', 'Ana Silva', 'Hardware', 'medium', 'open', 'Marcos Almeida', 'Marcos Almeida', 'TI'),
('Internet lenta', 'A internet está muito lenta no meu setor. Outros colegas também estão reclamando.', 'Carlos Santos', 'Rede', 'low', 'open', 'Marcos Almeida', 'Marcos Almeida', 'TI'),
('Impressora travada', 'Impressora do 2º andar está travando papel constantemente.', 'Maria Oliveira', 'Hardware', 'medium', 'resolved', 'João Silva', 'João Silva', 'TI'),
('Acesso ao sistema negado', 'Não consigo acessar o sistema de RH. Aparece mensagem de acesso negado.', 'Pedro Costa', 'Sistema', 'high', 'closed', 'Ana Santos', 'Ana Santos', 'TI');

-- Insert sample updates for the first ticket
INSERT INTO public.ticket_updates (ticket_id, author, content, type) 
SELECT id, 'Cleber Junior', 'Chamado criado', 'created' 
FROM public.tickets WHERE title = 'Erro no sistema ERP' LIMIT 1;