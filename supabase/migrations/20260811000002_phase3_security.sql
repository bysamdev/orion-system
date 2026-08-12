-- Migration: phase3_security

-- 1. Restrict RLS policies for api_keys table so only developer and admin roles can access them
DROP POLICY IF EXISTS "Users can view their own company API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can manage all company API keys" ON public.api_keys;

CREATE POLICY "Only developers and admins can manage API keys" 
    ON public.api_keys FOR ALL 
    USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'developer')
    );

-- 2. Encryption: pgcrypto, encrypt remote_password in tickets table, and create get_decrypted_remote_password function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Idempotent encryption of existing plain-text passwords
DO $$
DECLARE
    r RECORD;
    decrypted TEXT;
BEGIN
    FOR r IN SELECT id, remote_password FROM public.tickets WHERE remote_password IS NOT NULL LOOP
        BEGIN
            -- Try to decrypt assuming it's already base64 encoded pgp_sym_encrypt
            decrypted := pgp_sym_decrypt(decode(r.remote_password, 'base64'), 'orion-secret-256');
        EXCEPTION WHEN OTHERS THEN
            -- If it fails, it's not properly encrypted with our key, so we encrypt it
            UPDATE public.tickets 
            SET remote_password = encode(pgp_sym_encrypt(r.remote_password, 'orion-secret-256'), 'base64') 
            WHERE id = r.id;
        END;
    END LOOP;
END;
$$;

-- Trigger function to encrypt remote_password on insert or update
CREATE OR REPLACE FUNCTION encrypt_remote_password_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.remote_password IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.remote_password IS DISTINCT FROM OLD.remote_password) THEN
        NEW.remote_password := encode(pgp_sym_encrypt(NEW.remote_password, 'orion-secret-256'), 'base64');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encrypt_remote_password_on_tickets ON public.tickets;
CREATE TRIGGER encrypt_remote_password_on_tickets
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION encrypt_remote_password_trigger_fn();

-- Function to read decrypted remote_password
CREATE OR REPLACE FUNCTION get_decrypted_remote_password(p_ticket_id UUID)
RETURNS TEXT AS $$
DECLARE
    decrypted TEXT;
BEGIN
    SELECT pgp_sym_decrypt(decode(remote_password, 'base64'), 'orion-secret-256') INTO decrypted
    FROM public.tickets
    WHERE id = p_ticket_id AND remote_password IS NOT NULL;
    
    RETURN decrypted;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Trigger to synchronize assigned_to (text) with assigned_to_user_id (UUID) on tickets
CREATE OR REPLACE FUNCTION sync_ticket_assignment_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.assigned_to_user_id IS NOT NULL THEN
            SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id = NEW.assigned_to_user_id;
        ELSIF NEW.assigned_to IS NOT NULL THEN
            SELECT id INTO NEW.assigned_to_user_id FROM public.profiles WHERE full_name = NEW.assigned_to LIMIT 1;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
            IF NEW.assigned_to_user_id IS NOT NULL THEN
                SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id = NEW.assigned_to_user_id;
            ELSE
                NEW.assigned_to := NULL;
            END IF;
        ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            IF NEW.assigned_to IS NOT NULL THEN
                SELECT id INTO NEW.assigned_to_user_id FROM public.profiles WHERE full_name = NEW.assigned_to LIMIT 1;
            ELSE
                NEW.assigned_to_user_id := NULL;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_ticket_assignment ON public.tickets;
CREATE TRIGGER sync_ticket_assignment
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_assignment_fn();
