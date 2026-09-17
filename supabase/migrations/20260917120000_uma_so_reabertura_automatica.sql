-- =============================================================================
-- Uma só reabertura automática de chamado pausado
-- =============================================================================
--
-- O PROBLEMA
--
-- Havia DOIS gatilhos AFTER INSERT em ticket_updates fazendo a mesma coisa:
--
--   * tr_auto_resume_on_customer_reply      (20260814190000)
--   * reabre_chamado_quando_cliente_responde (20260914100000)
--
-- O segundo foi escrito para substituir o primeiro, com regras
-- deliberadamente mais estritas e documentadas no cabeçalho daquela migration:
--
--   * só o DONO do chamado reabre — o antigo também reabria para qualquer
--     usuário com role 'customer';
--   * awaiting-third-party fica de fora de propósito, porque ali quem se
--     aguarda é um fornecedor e a resposta do cliente não muda esse fato — o
--     antigo reabria nos dois estados.
--
-- Só que o antigo nunca foi removido. O Postgres dispara gatilhos por ordem
-- alfabética do nome, e tr_auto_resume_on_customer_reply_trigger vem antes de
-- trg_reabre_chamado_quando_cliente_responde. O antigo mudava o status
-- primeiro; o novo então relia o chamado, via que ele já não estava em
-- awaiting-customer e voltava sem fazer nada.
--
-- Ou seja: as duas decisões de 14/09 estavam escritas e sem efeito nenhum. Um
-- chamado em awaiting-third-party voltava a andar quando o cliente comentava,
-- exatamente o que aquela migration dizia não querer.
--
-- A CORREÇÃO
--
-- Remover o antigo, não tentar conciliar os dois. Duas implementações da mesma
-- regra não se equilibram — elas só escolhem qual das duas envelhece em
-- silêncio.
--
-- Verificado depois de aplicar, em transação desfeita:
--
--   comentário de terceiro em chamado pausado  -> segue awaiting-customer
--   comentário do dono em chamado pausado      -> volta para in-progress
--   transferência de técnico                   -> não pausa, segue in-progress
--   comentário do dono em awaiting-third-party -> segue awaiting-third-party
--
-- A última linha é a decisão de 14/09 entrando em vigor pela primeira vez.
--
-- tr_ticket_sla_pause, criada na mesma migration de agosto, NÃO é tocada: ela
-- cuida do relógio do SLA, não da reabertura, e continua correta.
--
-- NÃO ALTERA DADOS.
-- =============================================================================

DROP TRIGGER IF EXISTS tr_auto_resume_on_customer_reply_trigger ON public.ticket_updates;
DROP FUNCTION IF EXISTS public.tr_auto_resume_on_customer_reply();

COMMENT ON FUNCTION public.reabre_chamado_quando_cliente_responde() IS
  'Única reabertura automática do sistema: devolve o chamado em '
  'awaiting-customer para in-progress (com técnico) ou open (sem técnico) '
  'quando o DONO responde. awaiting-third-party fica de fora de propósito.';
