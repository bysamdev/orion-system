-- Add INSERT policy for profiles table (identified in security scan)
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Add DELETE policy for profiles table (for admin management)
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update the profiles SELECT policy to allow admins to view all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile or admins can view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'));

-- Add comment explaining the three access levels
COMMENT ON TYPE app_role IS 'Three access levels: customer (Colaborador - can create and track tickets), technician (Técnico de TI - can manage and resolve tickets), admin (Gestor de TI - full dashboard and reporting access)';

-- Ensure the default customer role is assigned to new users (already handled by trigger)
-- Verify the handle_new_user trigger is working correctly
COMMENT ON FUNCTION handle_new_user() IS 'Automatically creates a profile and assigns customer role to new users';
