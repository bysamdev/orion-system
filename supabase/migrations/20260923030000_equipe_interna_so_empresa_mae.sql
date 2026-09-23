-- ORN-SEC-02: técnico de empresa cliente deixa de ser "equipe interna".
--
-- is_equipe_interna() tratava technician de QUALQUER empresa como equipe
-- interna, e equipe interna enxerga todas as empresas (chamados, usuários,
-- máquinas). Um admin de empresa cliente podia promover um colega a
-- technician e, por ele, ver os dados de todos os outros clientes.
--
-- Nova regra, a única do sistema (o backend Go passa a usar esta mesma
-- função, ver lib/db.go UserScopeByID):
--   developer                                  -> equipe interna
--   technician ou admin de empresa mãe         -> equipe interna
--   admin sem empresa (legado)                 -> equipe interna
--   qualquer outro                             -> só a própria empresa
--
-- Em 23/09/2026 todos os técnicos e admins existentes são de empresa mãe:
-- ninguém perde acesso com esta mudança.

CREATE OR REPLACE FUNCTION public.is_equipe_interna(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.id = _user_id
      AND (
        ur.role = 'developer'::app_role
        OR (ur.role IN ('technician'::app_role, 'admin'::app_role) AND c.is_master = true)
        OR (ur.role = 'admin'::app_role AND p.company_id IS NULL)
      )
  );
$$;
