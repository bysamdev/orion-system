-- Seed default SLA policies for all companies
INSERT INTO public.sla_configs (name, company_id, urgent_hours, high_hours, medium_hours, low_hours, business_hours_only)
SELECT 'Padrão', id, 2, 8, 24, 72, false
FROM public.companies
WHERE NOT EXISTS (
  SELECT 1 FROM public.sla_configs WHERE company_id = public.companies.id
);
