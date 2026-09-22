-- Telefone no perfil, opcional. Serve de contato no atendimento e é o campo
-- que o WhatsApp vai precisar mais para frente para ligar o remetente a um
-- usuário real (card do whatsapp-webhook).
--
-- Guardado como a pessoa digita; a normalização fica para quando houver
-- integração de verdade.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_tamanho;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_tamanho CHECK (
  phone IS NULL OR length(btrim(phone)) BETWEEN 8 AND 20
);

COMMENT ON COLUMN public.profiles.phone IS
  'Telefone de contato, opcional, do jeito que a pessoa digitou.';
