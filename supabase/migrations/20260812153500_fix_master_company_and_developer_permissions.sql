-- Migration: Fix master company check to include 'Bysamdev Sistemas' and developer roles
-- Timestamp: 20260812153500

CREATE OR REPLACE FUNCTION public.is_master_company_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN companies c ON c.id = p.company_id
    LEFT JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id 
      AND (
        c.name IN ('Bysamdev Sistemas', 'Orion System') 
        OR ur.role = 'developer'::app_role
      )
  );
$function$;

-- Ensure master developer account has developer role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'developer'::app_role
FROM public.profiles
WHERE email = 'samterres42@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
