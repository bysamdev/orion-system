-- Migration: remove_hardcoded_encryption_key
-- SEC-04: a passphrase 'orion-secret-256' usada por pgp_sym_encrypt/decrypt em
-- 20260811000002_phase3_security.sql estava hardcoded e versionada em Git —
-- qualquer pessoa com acesso ao repositório conseguia decifrar
-- tickets.remote_password de qualquer empresa. A partir de agora a chave é
-- lida em runtime via current_setting('app.settings.encryption_key', true),
-- que deve ser configurado fora do código-fonte:
--   ALTER DATABASE postgres SET app.settings.encryption_key = '<segredo forte>';
-- (ou, preferencialmente, via Supabase Vault). Falha FECHADO: sem a
-- configuração, as funções de criptografia recusam operar em vez de usar um
-- valor previsível.

CREATE OR REPLACE FUNCTION public.get_encryption_key()
RETURNS TEXT AS $$
DECLARE
    k TEXT;
BEGIN
    k := current_setting('app.settings.encryption_key', true);
    IF k IS NULL OR k = '' THEN
        RAISE EXCEPTION 'app.settings.encryption_key não configurada — configure via Supabase Vault ou ALTER DATABASE antes de ler/gravar remote_password';
    END IF;
    RETURN k;
END;
$$ LANGUAGE plpgsql STABLE;

-- Reencripta, uma única vez, as linhas já existentes sob a chave antiga
-- hardcoded para a nova chave configurável. Idempotente: se a configuração
-- ainda não existir, a migration segue sem quebrar o deploy — basta reaplicar
-- (ou rodar manualmente o mesmo laço) depois de configurar a chave. Linhas já
-- migradas (ou corrompidas) são ignoradas silenciosamente por linha, nunca
-- pela migration inteira.
DO $$
DECLARE
    r RECORD;
    plain TEXT;
    new_key TEXT;
BEGIN
    BEGIN
        new_key := public.get_encryption_key();
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'app.settings.encryption_key ainda não configurada — pulando reencriptação de remote_password; configure a chave e reaplique esta migration';
        RETURN;
    END;

    FOR r IN SELECT id, remote_password FROM public.tickets WHERE remote_password IS NOT NULL LOOP
        BEGIN
            plain := pgp_sym_decrypt(decode(r.remote_password, 'base64'), 'orion-secret-256');
            UPDATE public.tickets
            SET remote_password = encode(pgp_sym_encrypt(plain, new_key), 'base64')
            WHERE id = r.id;
        EXCEPTION WHEN OTHERS THEN
            -- Já sob a nova chave (reexecução) ou dado que a chave antiga não abre; não sobrescreve.
            NULL;
        END;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION encrypt_remote_password_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.remote_password IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.remote_password IS DISTINCT FROM OLD.remote_password) THEN
        NEW.remote_password := encode(pgp_sym_encrypt(NEW.remote_password, public.get_encryption_key()), 'base64');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_decrypted_remote_password(p_ticket_id UUID)
RETURNS TEXT AS $$
DECLARE
    decrypted TEXT;
BEGIN
    SELECT pgp_sym_decrypt(decode(remote_password, 'base64'), public.get_encryption_key()) INTO decrypted
    FROM public.tickets
    WHERE id = p_ticket_id AND remote_password IS NOT NULL;

    RETURN decrypted;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
