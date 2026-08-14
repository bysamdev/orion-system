-- =================================================================================
-- Migration: Restore RLS Helpers
-- Description: Reconcede as permissões de EXECUTE para funções utilitárias que são
--              usadas ativamente nas políticas RLS do sistema. 
-- =================================================================================

GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_belongs_to_user_company TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_company_id TO authenticated;
