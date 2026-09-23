-- ORN-PERF-05: a auditoria de tickets gravava uma linha em audit_log a cada
-- recálculo de SLA e a cada atualização do índice de busca.
--
-- Medido em 23/09/2026: das 7.730 linhas de auditoria de tickets, 7.290 (94%)
-- só registravam mudança em sla_status, search_vector ou updated_at. E o
-- gatilho de auditoria era a maior parte do custo de um UPDATE de SLA:
-- ~4,2 ms com ele, ~0,9 ms sem ele (20 updates num chamado, média).
--
-- O gatilho único (INSERT OR UPDATE OR DELETE) vira dois: INSERT e DELETE
-- continuam auditados sempre; UPDATE só quando muda alguma coluna além
-- dessas três, que são calculadas pelo próprio sistema. Os outros 21
-- gatilhos de tickets não mudam: cada um já decide sozinho se age.

DROP TRIGGER IF EXISTS audit_tickets_changes ON public.tickets;

CREATE TRIGGER audit_tickets_changes
  AFTER INSERT OR DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_tickets_update
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  WHEN (
    (to_jsonb(OLD) - 'sla_status' - 'search_vector' - 'updated_at')
    IS DISTINCT FROM
    (to_jsonb(NEW) - 'sla_status' - 'search_vector' - 'updated_at')
  )
  EXECUTE FUNCTION public.audit_trigger_function();
