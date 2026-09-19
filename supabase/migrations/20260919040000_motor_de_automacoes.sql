-- =============================================================================
-- Motor de automações: regras com várias condições e ações, histórico real,
-- e acesso só para gestores
-- =============================================================================
--
-- O que estava errado (medido em 19/09/2026):
--   * automation_logs tinha 0 linhas: nada gravava o histórico, e a aba
--     Histórico da tela de Automações ficava sempre vazia.
--   * O motor (tr_auto_route_ticket) só entendia "igual a" em 4 campos e três
--     ações. A tela oferecia "contém", "diferente de", "Assunto", resposta
--     automática e notificar todos, que não faziam nada.
--   * Duas regras nunca casavam: "E-mail" gravada como 'e-mail' (a categoria é
--     'email') e "Urgente" como 'urgente' (a prioridade é 'urgent').
--   * O motor rodava antes do gatilho que preenche a empresa do chamado e via
--     company_id nulo: regra de empresa só casava se o cliente mandasse o
--     campo na requisição.
--   * fn_auto_route_ticket era uma segunda versão do motor, sem gatilho, e
--     ainda lia profiles.role, coluna que não existe.
--   * routing_rules e automation_logs aceitavam qualquer usuário das empresas
--     mãe, inclusive técnico. canned_responses deixava técnico criar, editar e
--     apagar templates.
--
-- Formato das regras: conditions e actions passam a aceitar LISTA
-- ([{field, operator, value}, ...] e [{type, target}, ...]). Todas as
-- condições precisam casar. O formato antigo (um objeto) continua valendo.
--
-- Como roda: o gatilho BEFORE INSERT avalia as regras e aplica o que muda o
-- próprio chamado (responsável, prioridade) e anota o que disparou em
-- metadata.automacoes. O gatilho AFTER INSERT, com o chamado já gravado, faz o
-- que precisa dele existir: histórico, notificações e resposta automática.
-- =============================================================================

-- Quem criou a regra assina a resposta automática que ela manda.
ALTER TABLE public.routing_rules
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

-- Valores em português que a tela antiga gravava e nunca casavam.
CREATE OR REPLACE FUNCTION public.normalizar_valor_de_regra(p_campo text, p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_campo = 'priority' THEN
      CASE lower(trim(p_valor))
        WHEN 'urgente' THEN 'urgent' WHEN 'alta' THEN 'high'
        WHEN 'media' THEN 'medium' WHEN 'média' THEN 'medium' WHEN 'baixa' THEN 'low'
        ELSE lower(trim(p_valor)) END
    WHEN p_campo = 'category' THEN
      CASE lower(trim(p_valor)) WHEN 'e-mail' THEN 'email' ELSE lower(trim(p_valor)) END
    ELSE p_valor
  END
$$;

-- Lista de condições ou de ações, aceitando o formato antigo (um objeto).
CREATE OR REPLACE FUNCTION public.itens_de_regra(p jsonb)
RETURNS SETOF jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT e FROM jsonb_array_elements(CASE jsonb_typeof(p) WHEN 'array' THEN p ELSE '[]'::jsonb END) e
  UNION ALL
  SELECT p WHERE jsonb_typeof(p) = 'object' AND p <> '{}'::jsonb
$$;

CREATE OR REPLACE FUNCTION public.regra_casa_com_chamado(p_condicoes jsonb, p_chamado public.tickets)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  c jsonb;
  v_campo text;
  v_op text;
  v_esperado text;
  v_atual text;
  v_casou boolean;
  v_alguma boolean := false;
BEGIN
  FOR c IN SELECT * FROM public.itens_de_regra(p_condicoes) LOOP
    v_alguma := true;
    v_campo := c->>'field';
    v_op := coalesce(c->>'operator', 'equals');
    v_esperado := public.normalizar_valor_de_regra(v_campo, c->>'value');
    v_atual := CASE v_campo
      WHEN 'category' THEN p_chamado.category
      WHEN 'priority' THEN p_chamado.priority
      WHEN 'company_id' THEN p_chamado.company_id::text
      WHEN 'department' THEN p_chamado.department
      WHEN 'title' THEN p_chamado.title
      ELSE NULL
    END;

    IF v_atual IS NULL OR v_esperado IS NULL THEN
      RETURN false;
    END IF;

    v_casou := CASE v_op
      WHEN 'equals' THEN lower(v_atual) = lower(v_esperado)
      WHEN 'not_equals' THEN lower(v_atual) <> lower(v_esperado)
      WHEN 'contains' THEN strpos(lower(v_atual), lower(v_esperado)) > 0
      ELSE false
    END;

    IF NOT v_casou THEN
      RETURN false;
    END IF;
  END LOOP;

  -- Regra sem condição nenhuma não dispara: seria "todo chamado", e isso
  -- precisa ser uma escolha explícita, não o resultado de um campo vazio.
  RETURN v_alguma;
END;
$$;

CREATE OR REPLACE FUNCTION public.tr_auto_route_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  regra RECORD;
  a jsonb;
  v_tipo text;
  v_alvo text;
  v_tech_id uuid;
  v_tech_nome text;
  v_prioridade text;
  v_disparos jsonb := '[]'::jsonb;
  v_resultado text;
BEGIN
  -- Gatilhos BEFORE rodam em ordem alfabética, e este (tr_auto...) roda antes
  -- de trigger_set_ticket_company, que é quem preenche a empresa. Sem isto o
  -- motor via company_id nulo e nenhuma regra de empresa casava. Mesma regra
  -- de set_ticket_company_from_user; ela grava o mesmo valor logo depois.
  NEW.company_id := coalesce(
    (SELECT company_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT company_id FROM public.profiles WHERE id = NEW.user_id),
    NEW.company_id);

  FOR regra IN
    SELECT * FROM public.routing_rules
     WHERE is_active = true
       AND (company_id = NEW.company_id OR company_id IS NULL)
     ORDER BY priority ASC, created_at ASC
  LOOP
    CONTINUE WHEN NOT public.regra_casa_com_chamado(regra.conditions, NEW);

    FOR a IN SELECT * FROM public.itens_de_regra(regra.actions) LOOP
      v_tipo := a->>'type';
      v_alvo := a->>'target';
      v_resultado := 'ok';

      IF v_tipo IN ('assign_to_user', 'assign_tech', 'escalate_manager') THEN
        -- A primeira regra que atribui vence; as seguintes não sobrescrevem.
        IF NEW.assigned_to_user_id IS NOT NULL THEN
          v_resultado := 'ignorado: chamado já tinha responsável';
        ELSIF v_alvo !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          v_resultado := 'erro: alvo inválido';
        ELSE
          SELECT full_name INTO v_tech_nome FROM public.profiles WHERE id = v_alvo::uuid;
          IF v_tech_nome IS NULL THEN
            v_resultado := 'erro: responsável não encontrado';
          ELSE
            NEW.assigned_to_user_id := v_alvo::uuid;
            NEW.assigned_to := v_tech_nome;
            v_resultado := 'atribuído a ' || v_tech_nome;
          END IF;
        END IF;

      ELSIF v_tipo = 'round_robin' THEN
        IF NEW.assigned_to_user_id IS NOT NULL THEN
          v_resultado := 'ignorado: chamado já tinha responsável';
        ELSE
          v_tech_id := NULL;
          SELECT p.id, p.full_name INTO v_tech_id, v_tech_nome
            FROM public.profiles p
            JOIN public.user_roles ur ON ur.user_id = p.id
            LEFT JOIN public.tickets t ON t.assigned_to_user_id = p.id
                 AND t.status IN ('open', 'reopened', 'in-progress')
           WHERE p.company_id = NEW.company_id
             AND (p.status IS NULL OR p.status = 'active')
             AND ur.role IN ('technician', 'admin', 'developer')
           GROUP BY p.id, p.full_name, p.last_assigned_at
           ORDER BY COUNT(t.id) ASC, p.last_assigned_at ASC NULLS FIRST, p.id ASC
           LIMIT 1;
          IF v_tech_id IS NULL THEN
            v_resultado := 'erro: nenhum técnico ativo na empresa';
          ELSE
            NEW.assigned_to_user_id := v_tech_id;
            NEW.assigned_to := v_tech_nome;
            UPDATE public.profiles SET last_assigned_at = now() WHERE id = v_tech_id;
            v_resultado := 'atribuído a ' || v_tech_nome;
          END IF;
        END IF;

      ELSIF v_tipo = 'set_priority' THEN
        v_prioridade := public.normalizar_valor_de_regra('priority', v_alvo);
        IF v_prioridade IN ('urgent', 'high', 'medium', 'low') THEN
          NEW.priority := v_prioridade;
          v_resultado := 'prioridade ' || v_prioridade;
        ELSE
          v_resultado := 'erro: prioridade inválida';
        END IF;

      ELSIF v_tipo NOT IN ('auto_response', 'notify_all') THEN
        v_resultado := 'erro: ação desconhecida';
      END IF;
      -- auto_response e notify_all rodam no AFTER INSERT, com o chamado gravado.

      v_disparos := v_disparos || jsonb_build_object(
        'rule_id', regra.id, 'rule_name', regra.name, 'created_by', regra.created_by,
        'type', v_tipo, 'target', v_alvo, 'result', v_resultado);
    END LOOP;
  END LOOP;

  IF jsonb_array_length(v_disparos) > 0 THEN
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object('automacoes', v_disparos);
  END IF;

  RETURN NEW;
END;
$$;

-- A timeline força o autor como auth.uid(). Na resposta automática quem está
-- logado é o cliente que abriu o chamado; sem esta exceção a resposta sairia
-- assinada por ele. A exceção só vale dentro da transação e só quando o
-- gatilho de automação liga orion.autor_automacao. Pela API ninguém consegue
-- ligar essa variável: o PostgREST só define as request.*.
CREATE OR REPLACE FUNCTION public.set_ticket_update_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_autor_automacao text := current_setting('orion.autor_automacao', true);
BEGIN
  IF v_autor_automacao IS NOT NULL AND v_autor_automacao <> '' THEN
    NEW.author_id := v_autor_automacao::uuid;
    NEW.author := 'Resposta automática';
    RETURN NEW;
  END IF;

  NEW.author_id := auth.uid();

  IF NEW.author IS NULL OR NEW.author = '' THEN
    NEW.author := COALESCE(
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      auth.uid()::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tr_automacoes_pos_abertura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d jsonb;
  v_resultado text;
  v_texto text;
  v_autor uuid;
BEGIN
  FOR d IN SELECT * FROM jsonb_array_elements(coalesce(NEW.metadata->'automacoes', '[]'::jsonb)) LOOP
    v_resultado := d->>'result';

    IF d->>'type' = 'notify_all' THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      SELECT DISTINCT p.id,
             'Novo chamado #' || NEW.ticket_number,
             'Regra "' || (d->>'rule_name') || '": ' || NEW.title,
             '/ticket/' || NEW.id
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
       WHERE ur.role IN ('technician', 'admin', 'developer')
         AND (p.company_id = NEW.company_id OR public.is_master_company_user(p.id));
      v_resultado := 'notificados: ' || (SELECT count(*) FROM public.notifications
                                           WHERE link = '/ticket/' || NEW.id
                                             AND title = 'Novo chamado #' || NEW.ticket_number);

    ELSIF d->>'type' = 'escalate_manager' AND (d->>'target') ~* '^[0-9a-f-]{36}$' THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES ((d->>'target')::uuid,
              'Chamado escalado para você: #' || NEW.ticket_number,
              'Regra "' || (d->>'rule_name') || '": ' || NEW.title,
              '/ticket/' || NEW.id);

    ELSIF d->>'type' = 'auto_response' THEN
      SELECT content INTO v_texto FROM public.canned_responses
       WHERE id::text = d->>'target';
      v_autor := coalesce((d->>'created_by')::uuid, NEW.assigned_to_user_id);
      IF v_texto IS NULL THEN
        v_resultado := 'erro: template não encontrado';
      ELSIF v_autor IS NULL THEN
        v_resultado := 'erro: regra sem criador para assinar a resposta';
      ELSE
        PERFORM set_config('orion.autor_automacao', v_autor::text, true);
        INSERT INTO public.ticket_updates (ticket_id, content, type, author, is_internal)
        VALUES (NEW.id, v_texto, 'comment', '', false);
        PERFORM set_config('orion.autor_automacao', '', true);
        v_resultado := 'resposta enviada';
      END IF;
    END IF;

    INSERT INTO public.automation_logs (rule_id, ticket_id, rule_name, action_type, action_result)
    VALUES ((d->>'rule_id')::uuid, NEW.id, d->>'rule_name', d->>'type', v_resultado);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_automacoes_pos_abertura ON public.tickets;
CREATE TRIGGER tr_automacoes_pos_abertura
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  WHEN (NEW.metadata ? 'automacoes')
  EXECUTE FUNCTION public.tr_automacoes_pos_abertura();

-- Segunda versão do motor, sem gatilho e lendo coluna inexistente.
DROP FUNCTION IF EXISTS public.fn_auto_route_ticket();

-- Regras antigas com valor em português.
UPDATE public.routing_rules
   SET conditions = jsonb_set(conditions, '{value}',
                              to_jsonb(public.normalizar_valor_de_regra(conditions->>'field', conditions->>'value')))
 WHERE jsonb_typeof(conditions) = 'object'
   AND conditions->>'field' IN ('priority', 'category')
   AND conditions->>'value' IS DISTINCT FROM public.normalizar_valor_de_regra(conditions->>'field', conditions->>'value');

-- -----------------------------------------------------------------------------
-- Permissões: automação é área de gestor (admin) e desenvolvedor.
-- Gestor da empresa-mãe e desenvolvedor veem e editam tudo; gestor de empresa
-- cliente, só a própria empresa. Técnico não entra.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_gerir_automacao(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(auth.uid(), 'developer'::app_role)
      OR (public.has_role(auth.uid(), 'admin'::app_role)
          AND (public.is_master_company_user(auth.uid())
               OR p_company_id = public.get_user_company_id(auth.uid())))
$$;

REVOKE EXECUTE ON FUNCTION public.pode_gerir_automacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_gerir_automacao(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can manage company routing rules" ON public.routing_rules;
DROP POLICY IF EXISTS "Admins can view company routing rules" ON public.routing_rules;
CREATE POLICY "Gestores gerem regras de automacao" ON public.routing_rules
  FOR ALL TO authenticated
  USING (public.pode_gerir_automacao(company_id))
  WITH CHECK (public.pode_gerir_automacao(company_id));

DROP POLICY IF EXISTS "Company-scoped automation log access" ON public.automation_logs;
CREATE POLICY "Gestores veem historico de automacao" ON public.automation_logs
  FOR SELECT TO authenticated
  USING (public.pode_gerir_automacao((SELECT t.company_id FROM public.tickets t WHERE t.id = ticket_id)));

-- Templates: técnico continua LENDO (usa nas respostas); só gestor escreve.
DROP POLICY IF EXISTS "Technicians and admins can create company canned responses" ON public.canned_responses;
DROP POLICY IF EXISTS "Technicians and admins can update company canned responses" ON public.canned_responses;
DROP POLICY IF EXISTS "Technicians and admins can delete company canned responses" ON public.canned_responses;
CREATE POLICY "Gestores criam templates" ON public.canned_responses
  FOR INSERT TO authenticated WITH CHECK (public.pode_gerir_automacao(company_id));
CREATE POLICY "Gestores editam templates" ON public.canned_responses
  FOR UPDATE TO authenticated
  USING (public.pode_gerir_automacao(company_id))
  WITH CHECK (public.pode_gerir_automacao(company_id));
CREATE POLICY "Gestores apagam templates" ON public.canned_responses
  FOR DELETE TO authenticated USING (public.pode_gerir_automacao(company_id));
