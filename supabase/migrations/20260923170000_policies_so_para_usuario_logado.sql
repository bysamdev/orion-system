-- Fase 7 da auditoria (lint 0028 do advisor): as funções auxiliares da RLS
-- rodam como SECURITY DEFINER e podiam ser chamadas sem login pela API
-- (/rest/v1/rpc/has_role etc.), revelando papel e empresa de qualquer uuid.
--
-- Não dava para revogar direto: 59 policies estavam criadas "TO public", e o
-- visitante sem login também avalia essas policies, então chamaria a função e
-- receberia erro de permissão em vez de lista vazia. Todas dependem de
-- auth.uid(), ou seja, nunca liberaram nada para quem não está logado. Passar
-- para "TO authenticated" não muda o acesso de ninguém logado; o visitante
-- simplesmente deixa de avaliá-las.

ALTER POLICY "Admins can view audit logs in their company" ON public.audit_log TO authenticated;
ALTER POLICY "Developers can view all audit logs" ON public.audit_log TO authenticated;
ALTER POLICY "Admins and techs can insert company machine_device_type_history" ON public.machine_device_type_history TO authenticated;
ALTER POLICY "Users can view company machine_device_type_history" ON public.machine_device_type_history TO authenticated;
ALTER POLICY "Admins and techs can insert company machine_groups" ON public.machine_groups TO authenticated;
ALTER POLICY "Admins and techs can update company machine_groups" ON public.machine_groups TO authenticated;
ALTER POLICY "Admins can delete company machine_groups" ON public.machine_groups TO authenticated;
ALTER POLICY "Users can view company machine_groups" ON public.machine_groups TO authenticated;
ALTER POLICY "Admins and techs can insert company machine_hardware" ON public.machine_hardware TO authenticated;
ALTER POLICY "Admins and techs can update company machine_hardware" ON public.machine_hardware TO authenticated;
ALTER POLICY "Admins can delete company machine_hardware" ON public.machine_hardware TO authenticated;
ALTER POLICY "Users can view company machine_hardware" ON public.machine_hardware TO authenticated;
ALTER POLICY "Admins and techs can insert company machines" ON public.machines TO authenticated;
ALTER POLICY "Admins and techs can update company machines" ON public.machines TO authenticated;
ALTER POLICY "Admins can delete company machines" ON public.machines TO authenticated;
ALTER POLICY "Users can view company machines" ON public.machines TO authenticated;
ALTER POLICY "Staff can delete their company endpoints" ON public.monitored_endpoints TO authenticated;
ALTER POLICY "Staff can insert their company endpoints" ON public.monitored_endpoints TO authenticated;
ALTER POLICY "Staff can update their company endpoints" ON public.monitored_endpoints TO authenticated;
ALTER POLICY "Users can delete their own notifications" ON public.notifications TO authenticated;
ALTER POLICY "Users can update their own notifications" ON public.notifications TO authenticated;
ALTER POLICY "Users can view their own notifications" ON public.notifications TO authenticated;
ALTER POLICY "Developers can manage plans" ON public.plans TO authenticated;
ALTER POLICY "Admins can delete profiles in their company" ON public.profiles TO authenticated;
ALTER POLICY "Admins can update profiles in their company" ON public.profiles TO authenticated;
ALTER POLICY "Developers can delete any profile" ON public.profiles TO authenticated;
ALTER POLICY "Developers can update any profile" ON public.profiles TO authenticated;
ALTER POLICY "Developers can view all profiles" ON public.profiles TO authenticated;
ALTER POLICY "Master company admins can delete all profiles" ON public.profiles TO authenticated;
ALTER POLICY "Master company admins can update all profiles" ON public.profiles TO authenticated;
ALTER POLICY "Master company users can view all profiles" ON public.profiles TO authenticated;
ALTER POLICY "Users can insert their own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can update their own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can view their own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can view resolution checklists of their company" ON public.resolution_checklists TO authenticated;
ALTER POLICY "Admins can create company ticket attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Admins can delete company ticket attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Admins can view company ticket attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Customers can create own ticket attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Customers can view own ticket attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Developers can create attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Developers can delete all attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Developers can view all attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Master admins can create all attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Master admins can delete all attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Master admins can view all attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Technicians can create company ticket attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Technicians can view company ticket attachments" ON public.ticket_attachments TO authenticated;
ALTER POLICY "Master technicians can view all status history" ON public.ticket_status_history TO authenticated;
ALTER POLICY "Admins delete company tickets" ON public.tickets TO authenticated;
ALTER POLICY "Admins update company tickets" ON public.tickets TO authenticated;
ALTER POLICY "Customers can reopen own tickets" ON public.tickets TO authenticated;
ALTER POLICY "Developers delete all tickets" ON public.tickets TO authenticated;
ALTER POLICY "Developers update all tickets" ON public.tickets TO authenticated;
ALTER POLICY "Master admins delete all tickets" ON public.tickets TO authenticated;
ALTER POLICY "Master admins update all tickets" ON public.tickets TO authenticated;
ALTER POLICY "Master technicians update all tickets" ON public.tickets TO authenticated;
ALTER POLICY "Technicians update company tickets" ON public.tickets TO authenticated;
ALTER POLICY select_tickets ON public.tickets TO authenticated;

-- Agora sim: as auxiliares deixam de ser chamáveis sem login.
REVOKE EXECUTE ON FUNCTION public.eh_usuario_de_maquina(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ticket_company_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_equipe_interna(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_master_company_user(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ticket_belongs_to_user_company(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.eh_usuario_de_maquina(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ticket_company_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_equipe_interna(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_company_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_belongs_to_user_company(uuid, uuid) TO authenticated, service_role;
