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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationsPopover } from './NotificationsPopover';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[];
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
      { icon: Home,     label: 'Início',              path: '/' },
      { icon: Ticket,   label: 'Novo Ticket',         path: '/novo-ticket' },
      { icon: History,  label: 'Histórico',           path: '/historico' },
      { icon: BookOpen, label: 'Base de Conhecimento',path: '/knowledge' },
      { icon: FileText, label: 'Manual de Uso',       path: '/tutorial' },
      {
        icon: Shield,
        label: 'Documentação API',
        path: '/documentacao',
        roles: ['admin', 'developer', 'technician'],
      },
    ],
  },
  {
    name: 'Infraestrutura',
    items: [
      { icon: Activity,      label: 'Sistemas e Alertas', path: '/sistemas', roles: ['admin', 'developer', 'technician'] },
      { icon: Layers,        label: 'Patches & Updates', path: '/patches',   roles: ['admin', 'developer'] },
      { icon: Cpu,           label: 'Ativos (CMDB)',    path: '/assets',     roles: ['admin', 'technician', 'developer'] },
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

export const Sidebar: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { data: role } = useUserRole();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Logout realizado com sucesso' });
    navigate('/auth');
  };

  const renderItem = (item: NavItem) => {
    if (item.roles && (!role || !item.roles.includes(role))) return null;
    const isActive = location.pathname === item.path;

    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        className={cn(
          'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] relative',
          isActive
            ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsla(var(--primary),0.3)]'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
        )}
        aria-label={item.label}
      >
        {/* Active indicator */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full shadow-[0_0_8px_hsla(var(--primary),0.8)]" />
        )}
        <item.icon
          className={cn(
            'w-4 h-4 shrink-0 transition-all duration-200',
            isActive ? 'text-primary' : 'group-hover:text-sidebar-foreground'
          )}
        />
        <span className="truncate leading-none">{item.label}</span>
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      <nav className="bg-sidebar-background h-screen w-64 flex flex-col shrink-0 sticky top-0 border-r border-sidebar-border shadow-2xl z-50 overflow-hidden">

        {/* ── Logo / Brand ── */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-5 py-5 cursor-pointer group border-b border-sidebar-border/40"
        >
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 transition-all duration-700 group-hover:rotate-[360deg] shrink-0">
            <div className="w-4 h-4 bg-primary rounded-md shadow-[0_0_12px_hsla(var(--primary),0.5)] flex items-center justify-center">
              <span className="text-[9px] font-black text-white italic">O</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-sidebar-foreground tracking-tight leading-none">Orion System</p>
            <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 uppercase tracking-widest">Painel de Controle</p>
          </div>
        </div>

        {/* ── Scrollable Nav ── */}
        <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar px-3 py-4 gap-6">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (i) => !i.roles || (role && i.roles.includes(role))
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.name} className="flex flex-col gap-1">
                {/* Group label */}
                <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-sidebar-foreground/30 select-none">
                  {group.name}
                </p>
                {visibleItems.map(renderItem)}
              </div>
            );
          })}
        </div>

        {/* ── Bottom: Notifications + Settings + Logout ── */}
        <div className="border-t border-sidebar-border/40 px-3 py-3 flex flex-col gap-1">
          {bottomItems.map(renderItem)}

          {/* Notifications inline button */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all cursor-pointer">
            <NotificationsPopover />
            <span className="text-sm font-medium">Notificações</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleSignOut}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 shrink-0 transition-colors group-hover:text-destructive" />
            <span>Sair do Sistema</span>
          </button>
        </div>

      </nav>
    </TooltipProvider>
  );
};
