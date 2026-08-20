import React from 'react';
import {
  Home,
  Ticket,
  History,
  BookOpen,
  FileText,
  Monitor,
  AlertTriangle,
  GitBranch,
  BarChart2,
  Layers,
  Cpu,
  Shield,
  LogOut,
  Bell,
  Activity,
  Settings,
  Globe,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import orionLogo from '@/assets/orion-logo.png';
import orionLogoLight from '@/assets/orion-logo-light.png';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[];
  matchPatterns?: string[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

// ─── Nav Data ─────────────────────────────────────────────────────────────────

const navGroups: NavGroup[] = [
  {
    name: 'Service Desk',
    items: [
      { icon: Ticket,   label: 'Novo Ticket',         path: '/novo-ticket' },
      { icon: History,  label: 'Histórico',           path: '/historico' },
      { icon: BookOpen, label: 'Base de Conhecimento', path: '/conhecimento' },
    ],
  },
  {
    name: 'Infraestrutura',
    items: [
      { icon: Activity,      label: 'Sistemas e Alertas', path: '/sistemas', roles: ['admin', 'developer', 'technician'] },
      { icon: Layers,        label: 'Instaladores & Updates', path: '/instaladores',   roles: ['admin', 'developer', 'technician'] },
      { icon: Cpu,           label: 'Inventário',      path: '/ativos',     roles: ['admin', 'technician', 'developer'] },
      { icon: Globe,         label: 'Monitoramento Web', path: '/monitoramento-web', roles: ['admin', 'technician', 'developer'] },
    ],
  },
  {
    name: 'Gestão',
    items: [
      { icon: GitBranch, label: 'Automações',       path: '/automacoes', roles: ['admin', 'developer'] },
      { icon: BarChart2, label: 'Insights & Relatórios', path: '/relatorios', roles: ['admin', 'developer'] },
      { icon: Shield,    label: 'Painel Admin',     path: '/admin',      roles: ['admin', 'developer'] },
    ],
  },
];

const bottomItems: NavItem[] = [
  { icon: Settings, label: 'Ajustes do Perfil', path: '/ajustes' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const AppSidebar: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();
  const { toast } = useToast();
  const { setOpenMobile, isMobile } = useSidebar();
  // const { unreadCount } = useNotifications();

  const roleLabel: Record<string, string> = {
    customer: 'Cliente',
    technician: 'Técnico',
    admin: 'Admin',
    developer: 'Desenvolvedor',
  };

  const go = (path: string) => {
    navigate(path);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Logout realizado com sucesso' });
    navigate('/auth');
  };

  const renderItem = (item: NavItem) => {
    const isAllowed = !item.roles || (role && item.roles.includes(role));
    if (!isAllowed) return null;

    const isActive = 
      location.pathname === item.path || 
      (item.path !== '/' && location.pathname.startsWith(item.path)) ||
      (item.matchPatterns?.some(pattern => location.pathname.startsWith(pattern)));

    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton 
          isActive={isActive} 
          tooltip={item.label} 
          onClick={() => isAllowed && go(item.path)}
          disabled={!isAllowed}
        >
          <item.icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <button
          onClick={() => navigate('/')}
          className="flex items-center px-3 pt-2 pb-3 cursor-pointer"
        >
          <img src={orionLogo} alt="Orion System" className="h-11 w-auto dark:hidden transition-all duration-200" />
          <img src={orionLogoLight} alt="Orion System" className="h-11 w-auto hidden dark:block transition-all duration-200" />
        </button>

        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-3 py-2 mx-1 mb-1 rounded-lg cursor-pointer group border-t border-sidebar-border/60 pt-3"
        >
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">{profile?.full_name || 'Carregando...'}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
              {role ? roleLabel[role] : '...'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderItem({ icon: Home, label: 'Início', path: '/', matchPatterns: ['/ticket/'] })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navGroups.map((group) => {
          const allowedItems = group.items.filter(item => !item.roles || (role && item.roles.includes(role)));
          if (allowedItems.length === 0) return null;

          return (
            <SidebarGroup key={group.name}>
              <SidebarGroupLabel>{group.name}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {allowedItems.map(renderItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {bottomItems.map(renderItem)}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair do Sistema" onClick={handleSignOut}>
              <LogOut />
              <span>Sair do Sistema</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
