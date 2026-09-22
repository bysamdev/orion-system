import React, { useState } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import orionLogo from '@/assets/orion-logo.png';
import orionLogoLight from '@/assets/orion-logo-light.png';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { InstitutionalLegalDialog } from '@/components/shared/InstitutionalLegalDialog';
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
  SidebarSeparator,
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
  const { setOpenMobile, isMobile, state, toggleSidebar } = useSidebar();
  const recolhido = state === 'collapsed' && !isMobile;
  const iniciais = (profile?.full_name || '?').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms');
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

  // Grade do menu: tudo alinha na mesma coluna de 8 px (o p-2 do grupo mais
  // o p-2 do botão). Logo, perfil, itens e rodapé usam os mesmos componentes
  // de menu, então as bordas e os ícones ficam alinhados entre si, aberto ou
  // recolhido. Recolhido, sobram só os ícones e o nome aparece no tooltip.
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-1">
        <div className="flex items-center gap-1 h-12">
          <button
            type="button"
            onClick={() => go('/')}
            aria-label="Ir para o Início"
            className={recolhido
              ? 'flex items-center justify-center size-8 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
              : 'flex items-center flex-1 min-w-0 px-2 h-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'}
          >
            {recolhido ? (
              <img src="/favicon.png" alt="Orion System" className="size-6 object-contain" />
            ) : (
              <>
                <img src={orionLogo} alt="Orion System" className="h-9 w-auto dark:hidden" />
                <img src={orionLogoLight} alt="Orion System" className="h-9 w-auto hidden dark:block" />
              </>
            )}
          </button>
          {!recolhido && !isMobile && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Recolher menu"
              className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {recolhido && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Expandir menu" onClick={toggleSidebar} aria-label="Expandir menu">
                <PanelLeftOpen />
                <span>Expandir menu</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={`${profile?.full_name || 'Perfil'} · ${role ? roleLabel[role] : ''}`}
              onClick={() => go('/ajustes')}
              aria-label="Acessar Ajustes do Perfil"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary text-xs font-semibold">
                {iniciais}
              </span>
              <span className="flex flex-col min-w-0 leading-tight">
                <span className="text-sm font-medium truncate">{profile?.full_name || 'Carregando...'}</span>
                <span className="text-[11px] text-muted-foreground truncate">{role ? roleLabel[role] : '...'}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

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

      <SidebarSeparator className="mx-0" />

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

        <div className="pt-1 px-2 pb-1 flex items-center gap-2 text-[11px] text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={() => { setLegalTab('terms'); setLegalOpen(true); }}
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Termos
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => { setLegalTab('privacy'); setLegalOpen(true); }}
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Privacidade
          </button>
          <span>•</span>
          <span>v1.0</span>
        </div>

        <InstitutionalLegalDialog
          open={legalOpen}
          onOpenChange={setLegalOpen}
          defaultTab={legalTab}
        />
      </SidebarFooter>
    </Sidebar>
  );
};
