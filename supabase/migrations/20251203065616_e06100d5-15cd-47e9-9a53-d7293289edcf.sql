-- Agendar cron job para auto-fechar tickets a cada hora
SELECT cron.schedule(
  'auto-close-resolved-tickets',
  '0 * * * *',
  $$SELECT public.auto_close_resolved_tickets()$$
);