-- =================================================================================
-- Migration: 20260910180000_drop_remote_password.sql
--
-- PREPARADA PARA REVISÃO — NÃO APLICADA AUTOMATICAMENTE NESTA RODADA.
--
-- Decisão de produto (CH-A01/DC-001, AUDITORIA-CHAMADOS-2026-09-04.md): o
-- ciclo de remote_password era "usuário digita → trigger criptografa →
-- ninguém lê" — get_decrypted_remote_password(uuid) tem zero chamadores em
-- src/ api/ handler/ lib/ cmd/ supabase/functions/ scripts/, e já está
-- restrita a service_role desde 20260813130002/20260818060001/20260901220000
-- (nenhum código invoca). O card que exibia o valor (ciphertext ilegível)
-- já tinha sido ocultado em NewTicket/TicketDetails antes desta migration;
-- esta leva removeu também o campo do formulário. Decisão: remover de vez,
-- não construir o caminho de leitura autorizado.
--
-- Derruba, nesta ordem (trigger antes da função que ele chama; função antes
-- da coluna que ela lê):
--   1. Trigger encrypt_remote_password_on_tickets (20260811000002_phase3_security.sql)
--   2. Função encrypt_remote_password_trigger_fn()
--   3. Função get_decrypted_remote_password(uuid)
--   4. Função get_encryption_key() — usada só pelas duas funções acima
--      (confirmado: report_schedules/get_cron_dispatch_secret usa um secret
--      de Vault próprio, não chama get_encryption_key())
--   5. Coluna public.tickets.remote_password
--
-- Antes de aplicar: confirmar que nenhuma integração externa (Zapier,
-- automação de cliente, script de suporte) lê tickets.remote_password
-- direto via PostgREST — é uma coluna pública de uma tabela com RLS, então
-- tecnicamente alcançável por quem já tem acesso de leitura ao ticket,
-- mesmo sem nenhum caminho de descriptografia. Rodar em staging primeiro.
-- =================================================================================

DROP TRIGGER IF EXISTS encrypt_remote_password_on_tickets ON public.tickets;
DROP FUNCTION IF EXISTS public.encrypt_remote_password_trigger_fn();
DROP FUNCTION IF EXISTS public.get_decrypted_remote_password(uuid);
DROP FUNCTION IF EXISTS public.get_encryption_key();
ALTER TABLE public.tickets DROP COLUMN IF EXISTS remote_password;
