# Relatório de Auditoria de QA Funcional - Orion System

## Resumo Executivo
Foi realizada uma auditoria funcional no repositório `orion-system` englobando fluxos de frontend (React), backend (Go) e banco de dados (Supabase PostgreSQL). Identificaram-se **falhas críticas na arquitetura transacional e de regras de negócio (triggers)**, **race conditions no client-side**, um **edge case grave envolvendo anexos**, e uma **ausência completa de testes automatizados**.

## 1. Race Conditions e Falta de Atomicidade (Client-Side)
**Local:** `src/hooks/useTickets.ts` e `TicketDetails.tsx` (`executeStatusChange`, `handleResolveConfirm`, `handleEscalateConfirm`)
**Criticidade:** ALTA

- **Problema:** A maioria das ações que modificam o estado de um chamado dispara chamadas de API (mutações) sequenciais. Por exemplo, ao atualizar o status, o sistema primeiro faz um `UPDATE` na tabela `tickets` e depois um `INSERT` na tabela `ticket_updates`.
- **Risco (Race Condition):** Se o usuário fechar a aba, a conexão de rede falhar, ou houver instabilidade no banco entre as chamadas, o estado ficará corrompido (ex: status alterado, mas sem log na timeline). O sistema de notificações de mudança de status recém-implementado (`create_notification_on_ticket_update`) depende estritamente da inserção bem-sucedida na tabela `ticket_updates`. Em caso de falha da segunda query, **o cliente nunca será notificado**.
- **Falta de Optimistic Concurrency Control (OCC):** Dois técnicos podem resolver/fechar o ticket ao mesmo tempo. Não há validação da versão ou estado atual do ticket na query de atualização (ex: `UPDATE ... WHERE status = 'expected_status'`).

## 2. Bugs Críticos no Motor de Roteamento (Banco de Dados / Triggers)
**Local:** `supabase/migrations/20260811000001_fix_tr_auto_route_ticket_crash.sql`
**Criticidade:** CRÍTICA (Potencial quebra de inserção de tickets e roteamento inoperante)

A tentativa de corrigir o motor de auto-roteamento de tickets introduziu anomalias graves que não foram testadas:
1. **Erro de Vínculo de Trigger:** A migration declara a função `tr_auto_route_ticket()`, mas esquece de associá-la ao trigger existente. O trigger real continua invocando a função antiga (`fn_auto_route_ticket()`). Ou seja, a correção atual não está operacional no banco.
2. **Contexto Inválido (BEFORE INSERT):** A nova função possui chamadas diretas de update como `UPDATE tickets SET assigned_to_user_id = ... WHERE id = NEW.id;`. Se acoplada como um trigger `BEFORE INSERT`, atualizará `0` linhas (porque a row não foi persistida ainda). A abordagem correta seria assinalar valores mutando o record (`NEW.assigned_to_user_id := ...`).
3. **Crash via Sintaxe PostgreSQL Incorreta:** O fallback da função tenta invocar um trigger utilizando instrução indevida: `PERFORM fn_auto_assign_ticket(NEW.id);`. Porém, `fn_auto_assign_ticket` é uma function do tipo `RETURNS TRIGGER` e não recebe argumentos. Em tempo de execução, caso nenhuma regra faça matching, isso lançará um `ERROR: function does not exist` abortando o ticket.
4. **Retrocesso do Balanceamento (Round-Robin):** A alteração converteu a lógica do balanceamento (`round_robin`) que antes considerava carga (contagem de chamados via `COUNT(t.id)`) em pura alocação randômica (`ORDER BY RANDOM() LIMIT 1`).

## 3. Edge Case: Expiração Inevitável de URLs de Anexos
**Local:** `src/hooks/useTicketAttachments.ts` (`useUploadAttachment`)
**Criticidade:** ALTA

- **Problema:** Ao fazer upload de um anexo, a API gera uma *Signed URL* com expiração fixa de 24 horas (`createSignedUrl(fileName, 60 * 60 * 24)`). Essa URL efêmera é gravada **permanentemente** na coluna `file_url` (tabela `ticket_attachments`).
- **Risco:** Passadas as 24 horas da anexação do arquivo, o link armazenado irá expirar. Os usuários e técnicos, ao abrirem um chamado histórico, se depararão com imagens e downloads quebrados.
- **Solução Recomendada:** Armazenar exclusivamente a chave/caminho (e.g. `fileName`) no banco de dados e delegar a geração do *Signed URL* para a renderização do frontend (ao listar) ou utilizar um Bucket público se o sigilo for configurado via RLS (Row Level Security).

## 4. Análise de Cobertura de Testes
**Criticidade:** CRÍTICA

Uma varredura e análise nas dependências do projeto constatou que a cobertura de testes automatizados atuais para lógicas de negócio do Orion System é **0%**.
- **Frontend (React/TypeScript):** Não há arquivos `.test.ts`, `.spec.tsx` implementados nas pastas `src/`.
- **Backend (Go e SQL):** Não constam implementações de testes (ex: `_test.go`) em `/api` ou `/handler`. Validações de migrations cruciais (via `pgTAP` ou equivalentes) são ausentes.
Isso potencializa exponencialmente os riscos listados neste relatório migrarem sem detecção prévia para a branch principal.

---
**Fim do Relatório.**
