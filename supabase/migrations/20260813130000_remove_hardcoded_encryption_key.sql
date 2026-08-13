-- Migration: remove_hardcoded_encryption_key
-- SEC-04: a passphrase 'orion-secret-256' usada por pgp_sym_encrypt/decrypt em
-- 20260811000002_phase3_security.sql estava hardcoded e versionada em Git —
-- qualquer pessoa com acesso ao repositório conseguia decifrar
-- tickets.remote_password de qualquer empresa. A partir de agora a chave é
-- lida do Supabase Vault (extensão supabase_vault já habilitada neste
-- projeto). `current_setting('app.settings.encryption_key', true)` foi
-- descartado como opção: `ALTER DATABASE ... SET` exige superuser, papel que
-- o Supabase managed Postgres não concede nem ao dono do projeto.
--
-- O segredo em si NÃO é criado por esta migration (nunca deve ir para o
-- Git) — ele é inserido uma vez por ambiente via:
--   SELECT vault.create_secret('<segredo forte>', 'orion_remote_password_encryption_key', 'SEC-04: chave de tickets.remote_password');
-- Falha FECHADO: sem o secret cadastrado no Vault, as funções de
-- criptografia recusam operar em vez de usar um valor previsível.

CREATE OR REPLACE FUNCTION public.get_encryption_key()
RETURNS TEXT AS $$
DECLARE
    k TEXT;
BEGIN
    SELECT decrypted_secret INTO k
    FROM vault.decrypted_secrets
    WHERE name = 'orion_remote_password_encryption_key'
    LIMIT 1;

    IF k IS NULL OR k = '' THEN
        RAISE EXCEPTION 'Secret orion_remote_password_encryption_key não encontrado no Supabase Vault — crie-o via vault.create_secret() antes de ler/gravar remote_password';
    END IF;
    RETURN k;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, vault;

-- O trigger PRECISA ser trocado para a nova chave antes do laço de
-- reencriptação abaixo: como ele dispara em qualquer UPDATE de
-- remote_password, se ainda estivesse na definição antiga (chave hardcoded)
-- ele reencriptaria por cima o valor que o laço acabou de gravar com a nova
-- chave, produzindo um dado com duas camadas de criptografia.
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

-- Reencripta, uma única vez, as linhas já existentes sob a chave antiga
-- hardcoded para a nova chave do Vault. Grava o texto puro e deixa o
-- trigger (já atualizado acima) fazer a criptografia com a chave nova —
-- assim nunca há chamada manual a pgp_sym_encrypt duplicando a lógica do
-- trigger. Idempotente: se o secret ainda não existir no Vault, a migration
-- segue sem quebrar o deploy — basta reaplicar depois de cadastrar a chave.
-- Linhas já migradas (ou corrompidas) são ignoradas silenciosamente por
-- linha, nunca pela migration inteira.
DO $$
DECLARE
    r RECORD;
BEGIN
    BEGIN
        PERFORM public.get_encryption_key();
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Secret orion_remote_password_encryption_key ainda não cadastrado no Vault — pulando reencriptação de remote_password; cadastre a chave e reaplique esta migration';
        RETURN;
    END;

    FOR r IN SELECT id, remote_password FROM public.tickets WHERE remote_password IS NOT NULL LOOP
        BEGIN
            UPDATE public.tickets
            SET remote_password = pgp_sym_decrypt(decode(r.remote_password, 'base64'), 'orion-secret-256')
            WHERE id = r.id;
        EXCEPTION WHEN OTHERS THEN
            -- Já sob a nova chave (reexecução) ou dado que a chave antiga não abre; não sobrescreve.
            NULL;
        END;
    END LOOP;
END;
$$;
