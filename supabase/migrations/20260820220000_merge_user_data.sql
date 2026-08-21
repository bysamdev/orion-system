-- Migration: merge_user_data — reatribui todos os dados de um usuário
-- "fantasma" (criado automaticamente pelo agente via machine-login) pra um
-- usuário real, antes de apagar o fantasma. Cenário: o mesmo humano acaba
-- com duas contas — uma via login direto no Orion, outra criada sozinha
-- pelo agente na primeira vez que ele clicou "Abrir Chamado" na bandeja.
--
-- source_id = quem desaparece (perde os dados, é apagado no fim).
-- target_id = quem permanece (recebe tudo do source).
--
-- Não apaga o usuário de auth.users nem a linha em profiles — isso o
-- backend Go faz depois, via sb.AdminDeleteUserByID (mesmo caminho já usado
-- por deleteUserAdmin), que também limpa profiles em cascata.
-- Created: 2026-08-20

CREATE OR REPLACE FUNCTION public.merge_user_data(source_id uuid, target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF source_id = target_id THEN
        RAISE EXCEPTION 'source_id e target_id não podem ser o mesmo usuário';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = source_id) THEN
        RAISE EXCEPTION 'source_id % não encontrado em profiles', source_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_id) THEN
        RAISE EXCEPTION 'target_id % não encontrado em profiles', target_id;
    END IF;

    -- user_roles tem UNIQUE(user_id, role) — um UPDATE simples colidiria se
    -- o target já tiver a mesma role que o source. A role que importa depois
    -- do merge é a do target (é quem permanece, quem o admin escolheu manter);
    -- as roles do source são só descartadas, não copiadas por cima.
    DELETE FROM public.user_roles WHERE user_id = source_id;

    UPDATE public.notifications          SET user_id             = target_id WHERE user_id             = source_id;
    UPDATE public.ticket_attachments     SET uploaded_by         = target_id WHERE uploaded_by         = source_id;
    UPDATE public.ticket_updates         SET author_id           = target_id WHERE author_id           = source_id;
    UPDATE public.tickets                SET user_id             = target_id WHERE user_id             = source_id;
    UPDATE public.tickets                SET assigned_to_user_id = target_id WHERE assigned_to_user_id = source_id;
    UPDATE public.canned_responses       SET created_by          = target_id WHERE created_by          = source_id;
    UPDATE public.knowledge_base_articles SET created_by         = target_id WHERE created_by          = source_id;
    UPDATE public.knowledge_base_articles SET updated_by         = target_id WHERE updated_by          = source_id;
    UPDATE public.machine_commands       SET executed_by_user_id = target_id WHERE executed_by_user_id = source_id;
    UPDATE public.package_deployments    SET dispatched_by       = target_id WHERE dispatched_by       = source_id;
    UPDATE public.remote_terminal_sessions SET opened_by         = target_id WHERE opened_by           = source_id;
    UPDATE public.software_packages      SET created_by          = target_id WHERE created_by          = source_id;
    UPDATE public.ticket_kb_links        SET linked_by           = target_id WHERE linked_by           = source_id;
    UPDATE public.ticket_status_history  SET changed_by          = target_id WHERE changed_by          = source_id;
    UPDATE public.time_entries           SET user_id             = target_id WHERE user_id             = source_id;
    UPDATE public.api_keys               SET user_id             = target_id WHERE user_id             = source_id;

    -- audit_log.changed_by é só trilha histórica (quem fez o quê antes do
    -- merge) — reatribuir preserva a auditoria legível em vez de deixar um
    -- id órfão depois que o source for apagado.
    UPDATE public.audit_log              SET changed_by          = target_id WHERE changed_by          = source_id;
END;
$$;

-- SECURITY DEFINER expõe a função via PostgREST em /rest/v1/rpc/merge_user_data
-- por padrão (concedida a anon/authenticated automaticamente ao criar) —
-- qualquer usuário logado (ou até anônimo, com a chave anon do frontend)
-- poderia chamar direto, sem passar pelo handler Go que checa role/tenancy
-- (SEC-02, mesmo padrão de deleteUserAdmin). Revoga: só quem conecta direto
-- no Postgres com a connection string do backend (service role) pode chamar.
REVOKE EXECUTE ON FUNCTION public.merge_user_data(uuid, uuid) FROM PUBLIC, anon, authenticated;
