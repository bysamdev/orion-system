-- =================================================================================
-- Migration: 20260825000100_rotate_bridge_secret.sql
-- Descrição: Rotaciona o segredo do orion-bridge.
--
-- O valor anterior ('c763084a31b36a59...') foi commitado em texto plano em
-- 20260818040000_secure_bridge_rpc_functions.sql -- qualquer um com acesso
-- de leitura ao repositório (ou ao git history) tem esse valor pra sempre,
-- mesmo que a linha seja removida depois. Só a rotação do valor real no
-- banco neutraliza isso.
--
-- Gerado com gen_random_bytes(32) direto no servidor -- o valor nunca passa
-- por este arquivo, nunca vai pro git. Depois de aplicar esta migration,
-- pegue o valor novo com service_role:
--   SELECT secret FROM public.bridge_secrets WHERE name = 'orion_bridge';
-- e configure no daemon orion-bridge (variável de ambiente, fora do git).
-- O bridge fica quebrado (401) entre a aplicação desta migration e a
-- atualização do env var no daemon -- coordenar o deploy.
-- =================================================================================

UPDATE public.bridge_secrets
SET secret = encode(gen_random_bytes(32), 'hex')
WHERE name = 'orion_bridge';
