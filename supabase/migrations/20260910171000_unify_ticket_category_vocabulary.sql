-- =================================================================================
-- Migration: 20260910171000_unify_ticket_category_vocabulary.sql
--
-- Achado CH-A04/DC-016 (AUDITORIA-CHAMADOS-2026-09-04.md): tickets.category é
-- TEXT sem CHECK, e cada ponto do código que grava um valor inventou o
-- próprio vocabulário — o formulário real (NewTicket.tsx) usa
-- erp/email/hardware/software/rede/outros (minúsculo), mas
-- resolution_checklists chegou a oferecer Sistema/Hardware/Acesso/Dúvida
-- (maiúsculo, palavras diferentes) e o chamado automático de RMM gravava
-- 'Infraestrutura' (maiúsculo). Como TicketDetails.tsx casa checklist com
-- chamado por igualdade exata de string (`.eq('category', ticket.category)`),
-- o vocabulário divergente fazia com que NENHUM checklist de resolução
-- pudesse bater com chamado nenhum.
--
-- Corrigido no código desta mesma leva (ticket-helpers.ts, lib/monitoring.go,
-- ResolutionChecklistManagement.tsx, mocks/tickets.ts) pra usar sempre o
-- slug minúsculo. Esta migration fecha a lacuna "sem constraint": confirmado
-- ao vivo que os dados reais já estavam limpos antes de aplicar (5 linhas em
-- tickets, 2 em resolution_checklists, todas já no vocabulário canônico) —
-- o CHECK só impede que ele se solte de novo.
--
-- 'infraestrutura' entra na lista porque já é usado em produção por
-- AbrirChamadoAlertaServidor (chamado aberto sozinho pelo RMM) — não é uma
-- opção do formulário humano (NewTicket.tsx), só do backend.
-- =================================================================================

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_category_valid
  CHECK (category IN ('erp', 'email', 'hardware', 'software', 'rede', 'outros', 'infraestrutura'));

ALTER TABLE public.resolution_checklists
  ADD CONSTRAINT resolution_checklists_category_valid
  CHECK (category IN ('erp', 'email', 'hardware', 'software', 'rede', 'outros', 'infraestrutura'));
