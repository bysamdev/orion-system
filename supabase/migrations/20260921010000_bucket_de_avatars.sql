-- Bucket de fotos de perfil. O AvatarUpload (src/components/settings)
-- sempre enviou para 'avatars', mas o bucket nunca foi criado: a troca de
-- foto falhava com "Bucket not found".
--
-- Público porque a foto é exibida por getPublicUrl em qualquer tela; a
-- leitura pública não depende de policy. A escrita fica restrita à pasta do
-- próprio usuário ({auth.uid}/avatar.ext). O envio usa upsert, que exige
-- INSERT + SELECT + UPDATE; o SELECT também fica só na própria pasta, para
-- ninguém listar as fotos dos outros pela API.
--
-- 2 MB basta: a imagem chega comprimida (512 px, WebP) do navegador.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars: dono lê a própria pasta" ON storage.objects;
DROP POLICY IF EXISTS "avatars: dono envia na própria pasta" ON storage.objects;
DROP POLICY IF EXISTS "avatars: dono substitui na própria pasta" ON storage.objects;
DROP POLICY IF EXISTS "avatars: dono apaga na própria pasta" ON storage.objects;

CREATE POLICY "avatars: dono lê a própria pasta" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "avatars: dono envia na própria pasta" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "avatars: dono substitui na própria pasta" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "avatars: dono apaga na própria pasta" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
