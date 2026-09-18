-- Schema do banco próprio do Orion Monitor (Postgres no servidor de
-- monitoramento). Aplicado pelo próprio serviço na subida; tudo aqui é
-- idempotente.
--
-- Não há chave estrangeira para o Supabase de propósito: são bancos
-- separados. machine_id e company_id são os mesmos UUIDs do cadastro do
-- Orion, que continua sendo a fonte da verdade sobre quem é a máquina.

CREATE TABLE IF NOT EXISTS maquina_estado (
  machine_id     uuid PRIMARY KEY,
  company_id     uuid NOT NULL,
  hostname       text NOT NULL,
  device_type    text,
  agent_version  text,
  os             text,
  os_version     text,
  ip             text,
  current_user_  text,
  cpu_pct        real,
  ram_used       bigint,
  ram_total      bigint,
  disk_used      bigint,
  disk_total     bigint,
  uptime_s       bigint,
  visto_em       timestamptz NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maquina_estado_company_idx ON maquina_estado (company_id);

-- Inventário. Quase nunca muda: só é regravado quando o conteúdo difere.
CREATE TABLE IF NOT EXISTS maquina_hardware (
  machine_id      uuid PRIMARY KEY,
  cpu_model       text,
  gpu             text,
  disks           jsonb,
  interfaces      jsonb,
  security_info   jsonb,
  remote_software jsonb,
  battery_info    jsonb,
  update_status   jsonb,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maquina_alerta (
  id          bigserial PRIMARY KEY,
  machine_id  uuid NOT NULL,
  company_id  uuid NOT NULL,
  tipo        text NOT NULL,
  severidade  text NOT NULL,
  mensagem    text NOT NULL,
  aberto_em   timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz
);

-- No máximo um alerta aberto por máquina e tipo. É o que torna o "abrir se
-- ainda não existe" seguro sem SELECT antes.
CREATE UNIQUE INDEX IF NOT EXISTS maquina_alerta_aberto_uidx
  ON maquina_alerta (machine_id, tipo) WHERE resolvido_em IS NULL;
