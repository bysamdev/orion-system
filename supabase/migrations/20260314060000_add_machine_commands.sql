-- Table for queuing remote commands to agents
CREATE TABLE IF NOT EXISTS public.machine_commands (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id   UUID          NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  command      TEXT          NOT NULL,
  status       TEXT          NOT NULL DEFAULT 'pending', -- pending, sent, completed, failed
  output       TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machine_commands_machine_id_status 
  ON public.machine_commands (machine_id, status);

-- RLS
ALTER TABLE public.machine_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage commands"
  ON public.machine_commands
  FOR ALL
  TO authenticated
  USING (true);
