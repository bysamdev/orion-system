-- =================================================================================
-- Migration: 20260825000300_fix_ticket_files_storage_rls.sql
-- Descrição: SUPERSEDIDA -- não aplicada em produção.
--
-- Ao conferir o estado real do banco antes do deploy (2026-08-25), a mesma
-- vulnerabilidade (LIKE aberto na policy de SELECT do bucket ticket-files,
-- sem validação de prefixo no INSERT) já tinha sido corrigida por outra
-- migration (histórico remoto: "20260825012251_security_audit_
-- remediations_corrected"), com uma abordagem equivalente: valida
-- split_part(objects.name, '/', 1) = t.id::text direto contra tickets, em
-- vez do join com ticket_attachments que esta migration usava.
--
-- Aplicar esta migration por cima criaria policies redundantes (mesmo
-- nome pra SELECT, nome diferente pra INSERT) sem ganho de segurança --
-- por isso o corpo abaixo é um no-op proposital. Mantido no histórico só
-- pra registro do que foi auditado e por quê não foi aplicado.
-- =================================================================================

SELECT 1; -- no-op intencional
