// Detecta títulos de tickets criados por ferramentas de teste/debug (ex:
// "[DEBUG-SLA-TEST]", em DebugTools.tsx) que não deveriam aparecer no
// histórico real de produção. Módulo isolado (sem import de Supabase) pra
// poder ser testado sem depender de localStorage/browser APIs.

const PADRAO_TICKET_DE_TESTE = /^\[(DEBUG|TEST)[-_]/i;

export function ehTituloDeTicketDeTeste(title: string | null | undefined): boolean {
  return typeof title === 'string' && PADRAO_TICKET_DE_TESTE.test(title);
}
