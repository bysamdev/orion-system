-- Migration: lock_down_encryption_functions
-- SEC-04 follow-up: `get_advisors(security)` flagged, right after
-- 20260813130000 shipped, that public.get_encryption_key() and the
-- pre-existing public.get_decrypted_remote_password(uuid) were both
-- executable by the `anon` and `authenticated` PostgREST roles as
-- SECURITY DEFINER functions — i.e. callable directly via
-- POST /rest/v1/rpc/get_encryption_key and
-- POST /rest/v1/rpc/get_decrypted_remote_password with no auth at all for
-- the former, and with any logged-in JWT and no tenant check at all for the
-- latter (it takes a raw ticket id, no company_id/scope validation). That
-- made the Vault-backed key strictly worse than the hardcoded one: instead
-- of reading source code, exfiltrating remote_password for every company
-- became a single unauthenticated HTTP request.
--
-- Neither function has any caller in the Go backend or the frontend (both
-- confirmed by repo-wide grep) — the frontend currently renders the raw
-- encrypted column via `select('*')`, it doesn't call the RPC. Revoking the
-- public grants here breaks nothing live.
--
-- encrypt_remote_password_trigger_fn becomes SECURITY DEFINER so writes
-- from `authenticated` (e.g. a ticket update via the Supabase client) can
-- still fire the encryption trigger without needing direct EXECUTE on
-- get_encryption_key() themselves.

-- Supabase grants EXECUTE on public-schema functions directly to anon and
-- authenticated at project bootstrap (not only via the PUBLIC pseudo-role),
-- so both REVOKE forms are needed — REVOKE ... FROM PUBLIC alone left
-- has_function_privilege('anon', ..., 'EXECUTE') true when verified live.
REVOKE EXECUTE ON FUNCTION public.get_encryption_key() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_remote_password(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_encryption_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_decrypted_remote_password(uuid) TO service_role;

-- Pre-existing function_search_path_mutable WARN on this function (present
-- since 20260811000002, unrelated to SEC-01..05 but trivial to close while
-- already touching its dependency chain for SEC-04).
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- pgp_sym_encrypt lives in the `extensions` schema on this project
-- (Supabase's standard pgcrypto install location), not `public` — the
-- search_path below must include it or every write that touches
-- remote_password fails with "function pgp_sym_encrypt(text, text) does
-- not exist" (hit and fixed live while rolling this migration out).
CREATE OR REPLACE FUNCTION encrypt_remote_password_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.remote_password IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.remote_password IS DISTINCT FROM OLD.remote_password) THEN
        NEW.remote_password := encode(pgp_sym_encrypt(NEW.remote_password, public.get_encryption_key()), 'base64');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Making it SECURITY DEFINER above also made it directly callable via
-- POST /rest/v1/rpc/encrypt_remote_password_trigger_fn (flagged by
-- get_advisors right after this was first applied). Trigger functions have
-- no business being invoked outside trigger context — NEW/OLD/TG_OP aren't
-- set, so a direct call just errors at runtime — but there's no reason to
-- leave the grant in place. INSERT/UPDATE that fire the trigger are
-- unaffected: trigger execution never goes through function-level EXECUTE
-- grants.
REVOKE EXECUTE ON FUNCTION public.encrypt_remote_password_trigger_fn() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_remote_password_trigger_fn() TO service_role;
