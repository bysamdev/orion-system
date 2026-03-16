-- Tables for CMDB (Assets)
CREATE TABLE IF NOT EXISTS public.assets (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name         TEXT          NOT NULL,
  type         TEXT          NOT NULL DEFAULT 'Hardware', -- 'Hardware', 'Software', 'License', 'Network'
  brand        TEXT,
  model        TEXT,
  serial_number TEXT,
  status       TEXT          NOT NULL DEFAULT 'active', -- 'active', 'maintenance', 'retired', 'lost'
  purchased_at DATE,
  warranty_until DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Join table for Tickets and Assets
CREATE TABLE IF NOT EXISTS public.ticket_assets (
  ticket_id    UUID          NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  asset_id     UUID          NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, asset_id)
);

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets of their company"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician', 'developer')
    )
  );

CREATE POLICY "Admins and Technicians can manage assets"
  ON public.assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician', 'developer')
    )
  );

CREATE POLICY "Users can view links for their tickets"
  ON public.ticket_assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR p.role IN ('admin', 'technician', 'developer'))
    )
  );

CREATE POLICY "Admins and Technicians can link assets to tickets"
  ON public.ticket_assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician', 'developer')
    )
  );
