-- =================================================================================
-- Migration: 20260914100000_pausa_fecha_sozinha_e_reabre_na_resposta.sql
--
-- Chamado em "Aguardando Cliente" passa a ter desfecho automático nos dois
-- sentidos:
--
--   sem resposta por 3 dias úteis  -> fecha
--   cliente responde               -> volta a andar
--
-- ---------------------------------------------------------------------------
-- De onde sai o relógio
--
-- sla_paused_at já existe e é preenchido por tr_ticket_sla_pause no instante
-- em que o chamado entra em awaiting-customer. É o carimbo certo: não dá para
-- usar updated_at (qualquer mexida no chamado o move) nem o último
-- ticket_updates (comentário interno da equipe reiniciaria a contagem).
--
-- ---------------------------------------------------------------------------
-- Dia útil, e por que o fuso importa
--
-- O banco roda em UTC. Uma pausa registrada sexta-feira às 22h em São Paulo é
-- sábado 01h em UTC — contar o dia da semana sobre o valor cru transformaria
-- sexta em sábado e adiaria o fechamento. Por isso adiciona_dias_uteis
-- converte para America/Sao_Paulo antes de olhar o dia.
--
-- Feriados NÃO são considerados: não existe calendário de feriados no banco,
-- e inventar um aqui seria pior que a omissão — ficaria desatualizado em
-- silêncio. O efeito prático é fechar um chamado um pouco mais cedo numa
-- semana com feriado. Se isso incomodar, o caminho é uma tabela de feriados e
-- um NOT EXISTS aqui dentro, não espalhar datas pelo código.
--
-- ---------------------------------------------------------------------------
-- O laço que esta mudança poderia criar, e não cria
--
-- Um chamado fechado por inatividade vira candidato ao bloqueio por avaliação
-- pendente (20260913110000): o cliente que ficou 3 dias sem responder seria
-- impedido de abrir chamado novo até avaliar justamente o chamado que ele
-- abandonou. Marcar metadata.fechado_por_inatividade dá à regra de bloqueio
-- como excluí-lo — mesmo mecanismo do merged_into da mesclagem.
--
-- ---------------------------------------------------------------------------
-- Para onde o chamado volta quando o cliente responde
--
-- Com técnico atribuído volta para 'in-progress', que o mantém na fila de
-- quem já estava cuidando. Sem atribuição volta para 'open', para ser
-- distribuído. Sair do estado de pausa faz tr_ticket_sla_pause retomar o SLA
-- e empurrar o vencimento pelo tempo parado — de graça, sem código aqui.
--
-- Só a resposta do DONO do chamado reabre. Comentário da equipe enquanto se
-- aguarda o cliente não conta, senão o próprio "oi, alguma novidade?" do
-- técnico tiraria o chamado da pausa. Comentário interno também não conta:
-- o cliente nem o vê.
--
-- awaiting-third-party fica de fora de propósito: ali quem se aguarda é um
-- fornecedor, e a resposta do cliente não muda esse fato.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.adiciona_dias_uteis(inicio timestamptz, dias integer)
 RETURNS timestamptz
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    resultado  timestamptz := inicio;
    restantes  integer     := dias;
BEGIN
    IF inicio IS NULL OR dias IS NULL OR dias <= 0 THEN
        RETURN inicio;
    END IF;

    WHILE restantes > 0 LOOP
        resultado := resultado + interval '1 day';
        -- isodow: 1=segunda ... 6=sábado, 7=domingo. O fuso é explícito
        -- porque o banco roda em UTC.
        IF extract(isodow from (resultado AT TIME ZONE 'America/Sao_Paulo')) < 6 THEN
            restantes := restantes - 1;
        END IF;
    END LOOP;

    RETURN resultado;
END;
$function$;

COMMENT ON FUNCTION public.adiciona_dias_uteis(timestamptz, integer) IS
  'Soma dias úteis (seg-sex, fuso America/Sao_Paulo). Não considera feriados.';

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fechar_chamados_em_pausa_sem_resposta()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    fechados integer;
BEGIN
    UPDATE public.tickets
       SET status     = 'closed',
           updated_at = now(),
           metadata   = coalesce(metadata, '{}'::jsonb)
                        || jsonb_build_object('fechado_por_inatividade', true,
                                              'fechado_por_inatividade_em', now())
     WHERE status = 'awaiting-customer'
       AND sla_paused_at IS NOT NULL
       AND now() >= public.adiciona_dias_uteis(sla_paused_at, 3);

    GET DIAGNOSTICS fechados = ROW_COUNT;
    RETURN fechados;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fechar_chamados_em_pausa_sem_resposta() FROM PUBLIC, anon, authenticated;

-- De hora em hora, como auto_close_resolved_tickets. Precisão de minuto não
-- serve para nada num prazo de 3 dias, e cada execução varre a tabela.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fechar-pausa-sem-resposta') THEN
        PERFORM cron.schedule(
            'fechar-pausa-sem-resposta',
            '30 * * * *',
            $cron$SELECT public.fechar_chamados_em_pausa_sem_resposta()$cron$
        );
    END IF;
END $$;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reabre_chamado_quando_cliente_responde()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_status   text;
    v_dono     uuid;
    v_atribuido uuid;
BEGIN
    IF NEW.is_internal THEN
        RETURN NEW;
    END IF;

    SELECT status, user_id, assigned_to_user_id
      INTO v_status, v_dono, v_atribuido
      FROM public.tickets
     WHERE id = NEW.ticket_id;

    IF v_status IS DISTINCT FROM 'awaiting-customer' THEN
        RETURN NEW;
    END IF;

    IF NEW.author_id IS DISTINCT FROM v_dono THEN
        RETURN NEW;
    END IF;

    UPDATE public.tickets
       SET status     = CASE WHEN v_atribuido IS NOT NULL THEN 'in-progress' ELSE 'open' END,
           updated_at = now()
     WHERE id = NEW.ticket_id;

    RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reabre_chamado_quando_cliente_responde() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reabre_chamado_quando_cliente_responde ON public.ticket_updates;
CREATE TRIGGER trg_reabre_chamado_quando_cliente_responde
    AFTER INSERT ON public.ticket_updates
    FOR EACH ROW EXECUTE FUNCTION public.reabre_chamado_quando_cliente_responde();
