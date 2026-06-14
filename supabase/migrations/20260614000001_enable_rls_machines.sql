-- Remove existing insecure policies
DROP POLICY IF EXISTS "Authenticated users can delete machines" ON machines;
DROP POLICY IF EXISTS "Authenticated users can insert machines" ON machines;
DROP POLICY IF EXISTS "Authenticated users can update machines" ON machines;
DROP POLICY IF EXISTS "Authenticated users can view machines" ON machines;
DROP POLICY IF EXISTS "Global insert for machines" ON machines;
DROP POLICY IF EXISTS "Global select for machines" ON machines;
DROP POLICY IF EXISTS "Global update for machines" ON machines;

DROP POLICY IF EXISTS "Authenticated users can delete machine_groups" ON machine_groups;
DROP POLICY IF EXISTS "Authenticated users can insert machine_groups" ON machine_groups;
DROP POLICY IF EXISTS "Authenticated users can update machine_groups" ON machine_groups;
DROP POLICY IF EXISTS "Authenticated users can view machine_groups" ON machine_groups;
DROP POLICY IF EXISTS "Global insert for groups" ON machine_groups;
DROP POLICY IF EXISTS "Global select for groups" ON machine_groups;

DROP POLICY IF EXISTS "Authenticated users can delete machine_hardware" ON machine_hardware;
DROP POLICY IF EXISTS "Authenticated users can insert machine_hardware" ON machine_hardware;
DROP POLICY IF EXISTS "Authenticated users can update machine_hardware" ON machine_hardware;
DROP POLICY IF EXISTS "Authenticated users can view machine_hardware" ON machine_hardware;

DROP POLICY IF EXISTS "Authenticated users can delete machine_metrics" ON machine_metrics;
DROP POLICY IF EXISTS "Authenticated users can insert machine_metrics" ON machine_metrics;
DROP POLICY IF EXISTS "Authenticated users can update machine_metrics" ON machine_metrics;
DROP POLICY IF EXISTS "Authenticated users can view machine_metrics" ON machine_metrics;

-- Drop new policies to ensure idempotency
DROP POLICY IF EXISTS "Users can view company machines" ON machines;
DROP POLICY IF EXISTS "Admins and techs can insert company machines" ON machines;
DROP POLICY IF EXISTS "Admins and techs can update company machines" ON machines;
DROP POLICY IF EXISTS "Admins can delete company machines" ON machines;

DROP POLICY IF EXISTS "Users can view company machine_groups" ON machine_groups;
DROP POLICY IF EXISTS "Admins and techs can insert company machine_groups" ON machine_groups;
DROP POLICY IF EXISTS "Admins and techs can update company machine_groups" ON machine_groups;
DROP POLICY IF EXISTS "Admins can delete company machine_groups" ON machine_groups;

DROP POLICY IF EXISTS "Users can view company machine_hardware" ON machine_hardware;
DROP POLICY IF EXISTS "Admins and techs can insert company machine_hardware" ON machine_hardware;
DROP POLICY IF EXISTS "Admins and techs can update company machine_hardware" ON machine_hardware;
DROP POLICY IF EXISTS "Admins can delete company machine_hardware" ON machine_hardware;

DROP POLICY IF EXISTS "Users can view company machine_metrics" ON machine_metrics;
DROP POLICY IF EXISTS "Admins and techs can insert company machine_metrics" ON machine_metrics;
DROP POLICY IF EXISTS "Admins and techs can update company machine_metrics" ON machine_metrics;
DROP POLICY IF EXISTS "Admins can delete company machine_metrics" ON machine_metrics;

-- Enable Row Level Security (RLS)
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for machines
CREATE POLICY "Users can view company machines" ON machines FOR SELECT USING (
  company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can insert company machines" ON machines FOR INSERT WITH CHECK (
  (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can update company machines" ON machines FOR UPDATE USING (
  (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can delete company machines" ON machines FOR DELETE USING (
  (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

-- Policies for machine_groups
CREATE POLICY "Users can view company machine_groups" ON machine_groups FOR SELECT USING (
  company_id = get_user_company_id(auth.uid()) OR is_master_company_user(auth.uid()) OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can insert company machine_groups" ON machine_groups FOR INSERT WITH CHECK (
  (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can update company machine_groups" ON machine_groups FOR UPDATE USING (
  (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can delete company machine_groups" ON machine_groups FOR DELETE USING (
  (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

-- Policies for machine_hardware
CREATE POLICY "Users can view company machine_hardware" ON machine_hardware FOR SELECT USING (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can insert company machine_hardware" ON machine_hardware FOR INSERT WITH CHECK (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can update company machine_hardware" ON machine_hardware FOR UPDATE USING (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can delete company machine_hardware" ON machine_hardware FOR DELETE USING (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

-- Policies for machine_metrics
CREATE POLICY "Users can view company machine_metrics" ON machine_metrics FOR SELECT USING (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can insert company machine_metrics" ON machine_metrics FOR INSERT WITH CHECK (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins and techs can update company machine_metrics" ON machine_metrics FOR UPDATE USING (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Admins can delete company machine_metrics" ON machine_metrics FOR DELETE USING (
  machine_id IN (SELECT id FROM machines WHERE company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_master_company_user(auth.uid()) 
  OR has_role(auth.uid(), 'developer'::app_role)
);
