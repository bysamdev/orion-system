-- Seed default departments for all companies
INSERT INTO public.departments (company_id, name)
SELECT c.id, d.name
FROM public.companies c
CROSS JOIN (
  VALUES 
    ('TI'), 
    ('Financeiro'), 
    ('RH'), 
    ('Comercial'), 
    ('Operações'), 
    ('Geral')
) AS d(name)
ON CONFLICT (company_id, name) DO NOTHING;
