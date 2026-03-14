-- Table for Ticket Ratings (CSAT)
CREATE TABLE IF NOT EXISTS public.ticket_ratings (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID          NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  rating       INTEGER       NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment      TEXT,
  user_id      UUID          NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ticket_ratings_ticket_id ON public.ticket_ratings(ticket_id);

-- RLS
ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can rate their own tickets"
  ON public.ticket_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Technicians and admins can see ratings"
  ON public.ticket_ratings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('technician', 'admin', 'developer')
    )
  );
