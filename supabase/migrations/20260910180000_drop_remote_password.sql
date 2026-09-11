-- =================================================================================
-- Migration: 20260910180000_drop_remote_password.sql
--
-- APLICADA EM 2026-09-11 (confirmado: trigger, as três funções e a coluna
-- não existem mais no catálogo).
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
-- Ressalva registrada na aplicação: a varredura de chamadores cobriu só o
-- repositório (src/ api/ handler/ lib/ cmd/ supabase/functions/ scripts/).
-- Integração externa fora do repo (Zapier, automação de cliente, script de
-- suporte) que lesse tickets.remote_password direto via PostgREST passa a
-- receber erro de coluna inexistente. O valor era ciphertext sem caminho de
-- descriptografia desde 20260813130000, então o dado já era inútil pra
-- qualquer consumidor — mas quem quebrar quebra aqui.
-- =================================================================================

DROP TRIGGER IF EXISTS encrypt_remote_password_on_tickets ON public.tickets;
DROP FUNCTION IF EXISTS public.encrypt_remote_password_trigger_fn();
DROP FUNCTION IF EXISTS public.get_decrypted_remote_password(uuid);
DROP FUNCTION IF EXISTS public.get_encryption_key();
ALTER TABLE public.tickets DROP COLUMN IF EXISTS remote_password;
