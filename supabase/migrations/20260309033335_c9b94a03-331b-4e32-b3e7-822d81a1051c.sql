
-- ============================================================
-- ORION SYSTEM: Modelo de Dados Completo
-- ============================================================

-- 1. AJUSTES EM TABELAS EXISTENTES
-- 1.1 companies: campos extras
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cnpj text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

-- 1.2 tickets: campos extras
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS satisfaction_rating smallint,
  ADD COLUMN IF NOT EXISTS satisfaction_comment text,
  ADD COLUMN IF NOT EXISTS scheduled_date timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Trigger de validação para satisfaction_rating (1-5) em vez de CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_satisfaction_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.satisfaction_rating IS NOT NULL AND (NEW.satisfaction_rating < 1 OR NEW.satisfaction_rating > 5) THEN
    RAISE EXCEPTION 'satisfaction_rating deve ser entre 1 e 5';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_satisfaction_rating ON public.tickets;
CREATE TRIGGER trg_validate_satisfaction_rating
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_satisfaction_rating();

-- Trigger para registrar closed_at e cancelled_at automaticamente
CREATE OR REPLACE FUNCTION public.track_ticket_close_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- closed_at
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    NEW.closed_at := NOW();
  END IF;
  -- cancelled_at
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := NOW();
  END IF;
  -- Limpar se reaberto
  IF NEW.status = 'reopened' THEN
    NEW.closed_at := NULL;
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_ticket_close_cancel ON public.tickets;
CREATE TRIGGER trg_track_ticket_close_cancel
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.track_ticket_close_cancel();

-- ============================================================
-- 2. NOVAS TABELAS
-- ============================================================

-- 2.1 sla_configs
CREATE TABLE public.sla_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  urgent_hours integer NOT NULL,
  high_hours integer NOT NULL,
  medium_hours integer NOT NULL,
  low_hours integer NOT NULL,
  business_hours_only boolean NOT NULL DEFAULT false,
  business_start time,
  business_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validação: horas > 0
CREATE OR REPLACE FUNCTION public.validate_sla_config_hours()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.urgent_hours <= 0 OR NEW.high_hours <= 0 OR NEW.medium_hours <= 0 OR NEW.low_hours <= 0 THEN
    RAISE EXCEPTION 'Todas as horas de SLA devem ser maiores que zero';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sla_config_hours
  BEFORE INSERT OR UPDATE ON public.sla_configs
  FOR EACH ROW EXECUTE FUNCTION public.validate_sla_config_hours();

CREATE TRIGGER trg_sla_configs_updated_at
  BEFORE UPDATE ON public.sla_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.2 contracts
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sla_config_id uuid REFERENCES public.sla_configs(id) ON DELETE SET NULL,
  monthly_hours numeric,
  start_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validação: end_date >= start_date
CREATE OR REPLACE FUNCTION public.validate_contract_dates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Data de término não pode ser anterior à data de início';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_contract_dates
  BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.validate_contract_dates();

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.3 categories (hierárquica)
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  icon text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- UNIQUE(name, company_id, parent_id) - tratando NULLs
CREATE UNIQUE INDEX idx_categories_unique_name 
  ON public.categories (name, company_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'));

-- Impedir auto-referência
CREATE OR REPLACE FUNCTION public.validate_category_parent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Categoria não pode ser pai de si mesma';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_category_parent
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_parent();

-- 2.4 services (catálogo)
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  default_priority text,
  estimated_hours numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_services_unique_name ON public.services (name, company_id);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.5 ticket_status_history
CREATE TABLE public.ticket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_status_history_ticket ON public.ticket_status_history (ticket_id, created_at DESC);

-- Trigger automático: registrar mudança de status no histórico
CREATE OR REPLACE FUNCTION public.log_ticket_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ticket_status_history (ticket_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ticket_status_change ON public.tickets;
CREATE TRIGGER trg_log_ticket_status_change
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();

-- Trigger: registrar status inicial na criação
CREATE OR REPLACE FUNCTION public.log_ticket_initial_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.ticket_status_history (ticket_id, old_status, new_status, changed_by)
  VALUES (NEW.id, NULL, NEW.status, COALESCE(auth.uid(), NEW.user_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ticket_initial_status ON public.tickets;
CREATE TRIGGER trg_log_ticket_initial_status
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_initial_status();

-- 2.6 time_entries
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_minutes integer,
  description text,
  billable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validações
CREATE OR REPLACE FUNCTION public.validate_time_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.end_time < NEW.start_time THEN
    RAISE EXCEPTION 'end_time não pode ser anterior a start_time';
  END IF;
  IF NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes < 0 THEN
    RAISE EXCEPTION 'duration_minutes não pode ser negativo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_time_entry
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_entry();

CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_time_entries_ticket ON public.time_entries (ticket_id);
CREATE INDEX idx_time_entries_user ON public.time_entries (user_id);

-- 2.7 knowledge_base_articles
CREATE TABLE public.knowledge_base_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  tags text[],
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  updated_by uuid,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kb_articles_company ON public.knowledge_base_articles (company_id);
CREATE INDEX idx_kb_articles_search ON public.knowledge_base_articles USING GIN (search_vector);

-- Trigger: manter search_vector
CREATE OR REPLACE FUNCTION public.update_kb_search_vector()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kb_search_vector
  BEFORE INSERT OR UPDATE ON public.knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_kb_search_vector();

CREATE TRIGGER trg_kb_articles_updated_at
  BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.8 ticket_kb_links (pivot)
CREATE TABLE public.ticket_kb_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles(id) ON DELETE CASCADE,
  linked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, article_id)
);

-- 2.9 custom_fields
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_type text NOT NULL,
  options jsonb,
  required boolean NOT NULL DEFAULT false,
  applies_to text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.10 custom_field_values
CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  entity_type text NOT NULL,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_field_id, entity_id)
);

CREATE TRIGGER trg_custom_field_values_updated_at
  BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. FKs em tickets para novas tabelas
-- ============================================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- Indexes para novas FKs
CREATE INDEX IF NOT EXISTS idx_tickets_contract ON public.tickets (contract_id);
CREATE INDEX IF NOT EXISTS idx_tickets_service ON public.tickets (service_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON public.tickets (category_id);

-- ============================================================
-- 4. RLS em todas as novas tabelas
-- ============================================================

-- Helper: buscar company_id de um ticket
CREATE OR REPLACE FUNCTION public.get_ticket_company_id(_ticket_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT company_id FROM tickets WHERE id = _ticket_id LIMIT 1;
$$;

-- 4.1 sla_configs
ALTER TABLE public.sla_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all sla_configs" ON public.sla_configs FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all sla_configs" ON public.sla_configs FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can view company sla_configs" ON public.sla_configs FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Technicians can view company sla_configs" ON public.sla_configs FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'technician'::app_role) AND company_id = get_user_company_id(auth.uid()));

-- 4.2 contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all contracts" ON public.contracts FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all contracts" ON public.contracts FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can view company contracts" ON public.contracts FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Technicians can view company contracts" ON public.contracts FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'technician'::app_role) AND company_id = get_user_company_id(auth.uid()));

-- 4.3 categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all categories" ON public.categories FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all categories" ON public.categories FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can manage company categories" ON public.categories FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view company categories" ON public.categories FOR SELECT
  TO authenticated USING (company_id = get_user_company_id(auth.uid()));

-- 4.4 services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all services" ON public.services FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all services" ON public.services FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can manage company services" ON public.services FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view company services" ON public.services FOR SELECT
  TO authenticated USING (company_id = get_user_company_id(auth.uid()));

-- 4.5 ticket_status_history (append-only para não-developers)
ALTER TABLE public.ticket_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all status history" ON public.ticket_status_history FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can view all status history" ON public.ticket_status_history FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can view company status history" ON public.ticket_status_history FOR SELECT
  TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  );

CREATE POLICY "Technicians can view company status history" ON public.ticket_status_history FOR SELECT
  TO authenticated USING (
    has_role(auth.uid(), 'technician'::app_role) 
    AND get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  );

CREATE POLICY "Customers can view own ticket status history" ON public.ticket_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

-- System insert (via trigger)
CREATE POLICY "System can insert status history" ON public.ticket_status_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- 4.6 time_entries
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all time_entries" ON public.time_entries FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all time_entries" ON public.time_entries FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can view company time_entries" ON public.time_entries FOR SELECT
  TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) 
    AND get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  );

CREATE POLICY "Technicians can manage own time_entries" ON public.time_entries FOR ALL
  TO authenticated USING (
    (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND user_id = auth.uid()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND user_id = auth.uid()
  );

-- 4.7 knowledge_base_articles
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all kb_articles" ON public.knowledge_base_articles FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all kb_articles" ON public.knowledge_base_articles FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins and techs can manage company kb_articles" ON public.knowledge_base_articles FOR ALL
  TO authenticated USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
    AND company_id = get_user_company_id(auth.uid())
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role))
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Customers can view public published kb_articles" ON public.knowledge_base_articles FOR SELECT
  TO authenticated USING (
    company_id = get_user_company_id(auth.uid()) AND is_public = true AND status = 'published'
  );

-- 4.8 ticket_kb_links
ALTER TABLE public.ticket_kb_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all ticket_kb_links" ON public.ticket_kb_links FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all ticket_kb_links" ON public.ticket_kb_links FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Techs and admins can manage company ticket_kb_links" ON public.ticket_kb_links FOR ALL
  TO authenticated USING (
    (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  )
  WITH CHECK (
    (has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND get_ticket_company_id(ticket_id) = get_user_company_id(auth.uid())
  );

CREATE POLICY "Customers can view links for own tickets" ON public.ticket_kb_links FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

-- 4.9 custom_fields
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all custom_fields" ON public.custom_fields FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all custom_fields" ON public.custom_fields FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Admins can manage company custom_fields" ON public.custom_fields FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view company custom_fields" ON public.custom_fields FOR SELECT
  TO authenticated USING (company_id = get_user_company_id(auth.uid()));

-- 4.10 custom_field_values
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage all custom_field_values" ON public.custom_field_values FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Master admins can manage all custom_field_values" ON public.custom_field_values FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_master_company_user(auth.uid()));

CREATE POLICY "Authenticated users can manage own entity custom_field_values" ON public.custom_field_values FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM custom_fields cf 
      WHERE cf.id = custom_field_id 
        AND cf.company_id = get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_fields cf 
      WHERE cf.id = custom_field_id 
        AND cf.company_id = get_user_company_id(auth.uid())
    )
  );
