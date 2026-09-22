-- Foto de perfil salva no perfil. O upload para o bucket 'avatars' já
-- funcionava (20260921010000_bucket_de_avatars.sql), mas o endereço da foto
-- não era guardado em lugar nenhum: ao recarregar a página, a foto sumia.
--
-- O próprio usuário grava pela policy "Users can update their own profile".
-- A CHECK impede apontar para qualquer endereço externo (pixel de rastreio,
-- imagem de terceiros): só vale a foto da pasta do próprio usuário no bucket
-- avatars deste projeto.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_do_proprio_usuario;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_do_proprio_usuario CHECK (
  avatar_url IS NULL
  OR avatar_url LIKE 'https://kcxwealimsfxqstoprdg.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%'
);

COMMENT ON COLUMN public.profiles.avatar_url IS
  'URL pública da foto de perfil no bucket avatars, na pasta do próprio usuário.';
