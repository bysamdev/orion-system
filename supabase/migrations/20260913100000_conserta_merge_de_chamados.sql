-- =================================================================================
-- Migration: 20260913100000_conserta_merge_de_chamados.sql
--
-- Conserta public.fn_merge_tickets, que nunca funcionou, e adiciona a trava de
-- mesclagem entre usuários diferentes (item 2 do lote de 2026-09-12).
--
-- ---------------------------------------------------------------------------
-- Por que "nunca funcionou"
--
-- A função inseria em ticket_updates (ticket_id, user_id, update_type, ...).
-- Nenhuma dessas duas colunas existe: são author_id e type. Medido chamando a
-- função numa transação revertida:
--
--   42703 :: column "user_id" of relation "ticket_updates" does not exist
--
-- O erro é levantado na primeira iteração do laço, antes de qualquer escrita.
-- Nenhum merge jamais foi concluído — o que também significa que não há dados
-- mesclados por esta função para migrar ou reparar.
--
-- Havia um segundo defeito atrás do primeiro: a função usava type = 'system',
-- e ticket_updates_type_valid não aceita esse valor. Consertar só os nomes das
-- colunas trocaria 42703 por 23514. Os tipos usados aqui ('comment' no chamado
-- principal, 'closed' no duplicado) estão na lista do CHECK.
--
-- ---------------------------------------------------------------------------
-- A trava
--
-- Origem e destino precisam ter o MESMO user_id. company_id igual é condição
-- adicional, não substituta: dois chamados podem ser da mesma empresa e de
-- pessoas diferentes.
--
-- A validação roda no banco porque a UI é contornável — o diálogo chama a RPC
-- direto do browser, e fn_merge_tickets tinha EXECUTE até para anon (revogado
-- no fim deste arquivo).
--
-- Todos os chamados são lidos e validados num primeiro laço, ANTES de qualquer
-- escrita. Sem isso, mesclar [ok, proibido] escreveria o primeiro e só então
-- falharia; como a função recebe um array, essa ordem importa.
--
-- ERRCODEs próprios, para o front distinguir de erro genérico:
--   ORI12  usuários diferentes
--   ORI13  empresas diferentes
--   ORI11  chamado inexistente
--   ORI10  principal presente na lista de duplicados
--   42501  quem chamou não tem permissão de mesclar aquele chamado
--
-- ---------------------------------------------------------------------------
-- Por que SECURITY DEFINER, tendo sido INVOKER
--
-- A primeira versão deste conserto manteve INVOKER. A medição mostrou que ela
-- fechava o duplicado e NÃO movia a timeline dele — silenciosamente:
--
--   tecnico mescla dois chamados do mesmo cliente:
--     duplicado -> closed, merged_into gravado
--     timeline do principal -> 3 entradas (as 2 dele + o aviso de merge)
--     as 9 entradas do duplicado -> continuaram no duplicado
--
-- A causa é a policy ticket_updates_update, que só deixa o autor editar a
-- própria entrada dentro de 15 minutos (ou developer, qualquer uma). Mover a
-- timeline de outra pessoa é justamente o que ela proíbe. Como UPDATE sob RLS
-- não levanta erro — apenas não encontra linha — o merge "dava certo" e perdia
-- o histórico de vista. Um developer teria visto o merge completo; um técnico,
-- não. É o pior tipo de defeito: depende de quem clica.
--
-- Repontar a timeline é inerentemente privilegiado, então a função passa a ser
-- SECURITY DEFINER e faz a autorização explicitamente. O predicado abaixo é a
-- união exata das quatro policies de UPDATE de tickets para equipe:
--
--   developer
--   (admin OR technician) AND is_master_company_user
--   (admin OR technician) AND company_id = get_user_company_id
--
-- Fica de fora, de propósito, "Customers can reopen own tickets": aquela
-- policy existe para o cliente reabrir o próprio chamado (WITH CHECK exige
-- status = reopened), não para mesclar. Sob INVOKER o cliente já falhava, só
-- que no meio da escrita; agora falha na porta, com 42501.
--
-- ---------------------------------------------------------------------------
-- metadata.merged_into
--
-- O duplicado é fechado, e o trigger track_ticket_close_cancel preenche
-- closed_at. Isso o tornaria elegível ao bloqueio por avaliação pendente da
-- migration seguinte: o cliente seria cobrado a avaliar um chamado que foi
-- absorvido por outro e que ele talvez nem reconheça. Marcar merged_into no
-- metadata dá à regra de bloqueio como excluí-lo.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.fn_merge_tickets(primary_id uuid, duplicate_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    dup_id            uuid;
    v_actor           uuid;
    v_dev             boolean;
    v_equipe          boolean;
    v_master          boolean;
    v_minha_empresa   uuid;
    v_primary_user    uuid;
    v_primary_company uuid;
    v_dup_user        uuid;
    v_dup_company     uuid;
BEGIN
    v_actor := auth.uid();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Mesclagem exige usuário autenticado.'
            USING ERRCODE = '28000';
    END IF;

    IF duplicate_ids IS NULL OR array_length(duplicate_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    IF primary_id = ANY(duplicate_ids) THEN
        RAISE EXCEPTION 'O chamado principal não pode estar na lista de duplicados.'
            USING ERRCODE = 'ORI10';
    END IF;

    -- Papel de quem chamou, resolvido uma vez. A função é DEFINER, então a RLS
    -- não faz mais essa filtragem por nós — ver o cabeçalho.
    v_dev           := has_role(v_actor, 'developer'::app_role);
    v_equipe        := has_role(v_actor, 'admin'::app_role)
                       OR has_role(v_actor, 'technician'::app_role);
    v_master        := is_master_company_user(v_actor);
    v_minha_empresa := get_user_company_id(v_actor);

    SELECT user_id, company_id
      INTO v_primary_user, v_primary_company
      FROM public.tickets
     WHERE id = primary_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado principal não encontrado.'
            USING ERRCODE = 'ORI11';
    END IF;

    IF NOT (v_dev OR (v_equipe AND (v_master OR v_primary_company = v_minha_empresa))) THEN
        RAISE EXCEPTION 'Sem permissão para mesclar este chamado.'
            USING ERRCODE = '42501';
    END IF;

    -- Primeiro laço: valida tudo. Nenhuma escrita acontece antes daqui.
    FOREACH dup_id IN ARRAY duplicate_ids
    LOOP
        SELECT user_id, company_id
          INTO v_dup_user, v_dup_company
          FROM public.tickets
         WHERE id = dup_id
           FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Chamado % não encontrado.', dup_id
                USING ERRCODE = 'ORI11';
        END IF;

        IF NOT (v_dev OR (v_equipe AND (v_master OR v_dup_company = v_minha_empresa))) THEN
            RAISE EXCEPTION 'Sem permissão para mesclar o chamado %.', dup_id
                USING ERRCODE = '42501';
        END IF;

        IF v_dup_user IS DISTINCT FROM v_primary_user THEN
            RAISE EXCEPTION 'Não é possível mesclar chamados de usuários diferentes.'
                USING ERRCODE = 'ORI12';
        END IF;

        IF v_dup_company IS DISTINCT FROM v_primary_company THEN
            RAISE EXCEPTION 'Não é possível mesclar chamados de empresas diferentes.'
                USING ERRCODE = 'ORI13';
        END IF;
    END LOOP;

    -- Segundo laço: escreve.
    FOREACH dup_id IN ARRAY duplicate_ids
    LOOP
        UPDATE public.ticket_updates     SET ticket_id = primary_id WHERE ticket_id = dup_id;
        UPDATE public.ticket_attachments SET ticket_id = primary_id WHERE ticket_id = dup_id;

        INSERT INTO public.ticket_updates (ticket_id, author_id, author, content, type)
        VALUES (primary_id, v_actor, '',
                'Chamado ' || dup_id || ' foi mesclado a este chamado.', 'comment');

        UPDATE public.tickets
           SET status   = 'closed',
               metadata = coalesce(metadata, '{}'::jsonb)
                          || jsonb_build_object('merged_into', primary_id::text,
                                                'merged_at',   now())
         WHERE id = dup_id;

        INSERT INTO public.ticket_updates (ticket_id, author_id, author, content, type)
        VALUES (dup_id, v_actor, '',
                'Este chamado foi mesclado ao chamado ' || primary_id || ' e encerrado.', 'closed');
    END LOOP;
END;
$function$;

-- A chave anon de um projeto Supabase é pública. Mesclar chamados não é
-- operação de visitante não autenticado, e a função já exige auth.uid().
REVOKE EXECUTE ON FUNCTION public.fn_merge_tickets(uuid, uuid[]) FROM anon;
