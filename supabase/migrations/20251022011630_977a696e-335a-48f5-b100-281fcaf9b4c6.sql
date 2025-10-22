-- ============================================
-- OTIMIZAÇÃO COMPLETA DO BANCO V4 (SEM VACUUM)
-- ============================================

-- ============================================
-- PARTE 1: FOREIGN KEYS
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_user_id') THEN
    ALTER TABLE public.tickets ADD CONSTRAINT fk_tickets_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_assigned_to_user_id') THEN
    ALTER TABLE public.tickets ADD CONSTRAINT fk_tickets_assigned_to_user_id FOREIGN KEY (assigned_to_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ticket_updates_ticket_id') THEN
    ALTER TABLE public.ticket_updates ADD CONSTRAINT fk_ticket_updates_ticket_id FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ticket_updates_author_id') THEN
    ALTER TABLE public.ticket_updates ADD CONSTRAINT fk_ticket_updates_author_id FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_profiles_company_id') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_company_id FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_departments_company_id') THEN
    ALTER TABLE public.departments ADD CONSTRAINT fk_departments_company_id FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_user_roles_user_id') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- PARTE 2: TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
DROP TRIGGER IF EXISTS validate_ticket_before_insert_update ON public.tickets;
DROP TRIGGER IF EXISTS validate_profile_before_insert_update ON public.profiles;
DROP TRIGGER IF EXISTS validate_company_before_insert_update ON public.companies;
DROP TRIGGER IF EXISTS set_ticket_update_author_trigger ON public.ticket_updates;
DROP TRIGGER IF EXISTS validate_assignment_before_update ON public.tickets;

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER validate_ticket_before_insert_update BEFORE INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_input();
CREATE TRIGGER validate_profile_before_insert_update BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile_input();
CREATE TRIGGER validate_company_before_insert_update BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.validate_company_input();
CREATE TRIGGER set_ticket_update_author_trigger BEFORE INSERT ON public.ticket_updates FOR EACH ROW EXECUTE FUNCTION public.set_ticket_update_author();
CREATE TRIGGER validate_assignment_before_update BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_assignment();

-- ============================================
-- PARTE 3: COLUNAS NOT NULL
-- ============================================

UPDATE public.profiles SET email = COALESCE(email, 'sem-email-' || id || '@temporario.com') WHERE email IS NULL;
UPDATE public.profiles SET full_name = COALESCE(full_name, 'Usuário ' || SUBSTRING(id::text, 1, 8)) WHERE full_name IS NULL;
UPDATE public.ticket_updates SET author_id = COALESCE(author_id, (SELECT user_id FROM tickets WHERE tickets.id = ticket_updates.ticket_id LIMIT 1)) WHERE author_id IS NULL;

ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE public.ticket_updates ALTER COLUMN author_id SET NOT NULL;

-- ============================================
-- PARTE 4: ÍNDICES
-- ============================================

DROP INDEX IF EXISTS public.idx_profiles_company;
DROP INDEX IF EXISTS public.idx_tickets_assigned_to_user_id;

CREATE INDEX IF NOT EXISTS idx_tickets_user_status_created ON public.tickets USING btree (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_created_priority_status ON public.tickets USING btree (created_at DESC, priority, status);
CREATE INDEX IF NOT EXISTS idx_profiles_company_email ON public.profiles USING btree (company_id, email) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket_author ON public.ticket_updates USING btree (ticket_id, author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_active_status ON public.tickets USING btree (status, priority, created_at DESC) WHERE status NOT IN ('closed', 'resolved');
CREATE INDEX IF NOT EXISTS idx_tickets_unassigned ON public.tickets USING btree (created_at DESC, priority) WHERE assigned_to_user_id IS NULL AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_profiles_active_with_company ON public.profiles USING btree (company_id, full_name) WHERE company_id IS NOT NULL;

-- ============================================
-- PARTE 5: BUSCA FULL-TEXT
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'search_vector') THEN
    ALTER TABLE public.tickets ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('portuguese', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('portuguese', coalesce(requester_name, '')), 'C')
    ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_search ON public.tickets USING GIN (search_vector);

CREATE OR REPLACE FUNCTION public.search_tickets(search_query text)
RETURNS TABLE (id uuid, ticket_number integer, title text, description text, status text, priority text, created_at timestamptz, rank real) 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.ticket_number, t.title, t.description, t.status, t.priority, t.created_at,
         ts_rank(t.search_vector, websearch_to_tsquery('portuguese', search_query)) as rank
  FROM tickets t
  WHERE t.search_vector @@ websearch_to_tsquery('portuguese', search_query)
  ORDER BY rank DESC, t.created_at DESC LIMIT 100;
$$;

-- ============================================
-- PARTE 6: AUDITORIA
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES public.profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON public.audit_log(changed_by) WHERE changed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs in their company" ON public.audit_log;
DROP POLICY IF EXISTS "Developers can view all audit logs" ON public.audit_log;

CREATE POLICY "Admins can view audit logs in their company" ON public.audit_log FOR SELECT TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) AND (changed_by IN (SELECT id FROM profiles WHERE company_id = (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))) OR changed_by IS NULL));

CREATE POLICY "Developers can view all audit logs" ON public.audit_log FOR SELECT TO authenticated
USING (has_role((SELECT auth.uid()), 'developer'::app_role));

CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by) VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by) VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by) VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_tickets_trigger ON public.tickets;
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON public.user_roles;
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;

CREATE TRIGGER audit_tickets_trigger AFTER INSERT OR UPDATE OR DELETE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
CREATE TRIGGER audit_user_roles_trigger AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
CREATE TRIGGER audit_profiles_trigger AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- ============================================
-- PARTE 7: POLÍTICAS RLS EXTRAS
-- ============================================

DROP POLICY IF EXISTS "Prevent self-promotion to admin" ON public.user_roles;
CREATE POLICY "Prevent self-promotion to admin" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role) OR (user_id != (SELECT auth.uid()) OR role != 'admin'::app_role));

-- ============================================
-- PARTE 8: AUTOVACUUM
-- ============================================

ALTER TABLE public.tickets SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.user_roles SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.ticket_updates SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.05);

-- ============================================
-- PARTE 9: FUNÇÕES DE MONITORAMENTO
-- ============================================

CREATE OR REPLACE FUNCTION public.check_index_health()
RETURNS TABLE (table_name text, index_name text, index_size text, index_scans bigint, rows_read bigint, rows_fetched bigint, efficiency numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT schemaname || '.' || relname as table_name, indexrelname as index_name, pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
         idx_scan as index_scans, idx_tup_read as rows_read, idx_tup_fetch as rows_fetched,
         CASE WHEN idx_scan = 0 THEN 0 ELSE ROUND((idx_tup_fetch::numeric / NULLIF(idx_tup_read, 0) * 100), 2) END as efficiency
  FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan ASC;
$$;

CREATE OR REPLACE FUNCTION public.check_table_bloat()
RETURNS TABLE (table_name text, total_size text, live_tuples bigint, dead_tuples bigint, dead_ratio numeric, needs_vacuum boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT schemaname || '.' || relname as table_name, pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
         n_live_tup as live_tuples, n_dead_tup as dead_tuples,
         ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio,
         (n_dead_tup > 1000 OR (n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0)) > 20) as needs_vacuum
  FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_dead_tup DESC;
$$;