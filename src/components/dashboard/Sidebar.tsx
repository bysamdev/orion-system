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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/hooks/useNotifications';

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
      { icon: BookOpen, label: 'Base de Conhecimento', path: '/knowledge' },
    ],
  },
  {
    name: 'Infraestrutura',
    items: [
      { icon: Activity,      label: 'Sistemas e Alertas', path: '/sistemas', roles: ['admin', 'developer', 'technician'] },
      { icon: Layers,        label: 'Patches & Updates', path: '/patches',   roles: ['admin', 'developer', 'technician'] },
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

export const Sidebar: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { data: role } = useUserRole();
  const { toast } = useToast();
  const { unreadCount } = useNotifications();

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
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
      <button
        key={item.path}
        onClick={() => isAllowed && go(item.path)}
        disabled={!isAllowed}
        className={cn(
          'group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative',
          'cursor-pointer active:scale-[0.98]',
          isActive
            ? 'bg-purple-600'
            : 'hover:bg-purple-500/10'
        )}
        aria-label={item.label}
      >
        <item.icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors duration-200',
            isActive ? 'text-white' : 'text-gray-400 group-hover:text-purple-400'
          )}
        />
        <span
          className={cn(
            'truncate leading-none text-sm font-medium transition-colors duration-200 flex-1 text-left',
            isActive ? 'text-white' : 'text-gray-400 group-hover:text-purple-300'
          )}
          title={item.label}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="bg-sidebar-background h-screen w-64 flex flex-col shrink-0 sticky top-0 border-r border-sidebar-border shadow-2xl z-50 overflow-hidden">

        {/* ── Logo / Brand ── */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-5 py-5 cursor-pointer group border-b border-sidebar-border/40"
        >
          <div className="min-w-0">
            <p className="text-sm font-black text-sidebar-foreground tracking-tight leading-none">Orion System</p>
            <p className="text-[10px] text-sidebar-foreground/60 mt-0.5 uppercase tracking-widest">Painel de Controle</p>
          </div>
        </div>

        {/* ── Scrollable Nav ── */}
        <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar px-3 py-4 gap-5">
          {/* Top Isolated Item */}
        <div className="flex flex-col gap-1 mb-4">
        {renderItem({ icon: Home, label: 'Início', path: '/', matchPatterns: ['/ticket/'] })}
        </div>

          {navGroups.map((group) => {
            const allowedItems = group.items.filter(item => !item.roles || (role && item.roles.includes(role)));
            if (allowedItems.length === 0) return null;

            return (
              <div key={group.name} className="flex flex-col gap-1">
                {/* Group label */}
                <p className="px-3 mt-4 mb-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/75 select-none">
                  {group.name}
                </p>
                {allowedItems.map(renderItem)}
              </div>
            );
          })}
        </div>

        {/* ── Bottom: Notifications + Settings + Logout ── */}
        <div className="border-t border-sidebar-border/40 px-3 py-3 flex flex-col gap-1">
          {bottomItems.map(renderItem)}

          {/* Notificações como item de navegação padrão */}
          <button
            onClick={() => { navigate('/notificacoes'); onNavigate?.(); }}
            className={cn(
              'group w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 active:scale-[0.98] relative outline-none',
              location.pathname === '/notificacoes'
                ? 'bg-purple-600'
                : 'hover:bg-purple-500/10'
            )}
          >
            <div className="relative flex items-center justify-center">
              <Bell
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors duration-200',
                  location.pathname === '/notificacoes' ? 'text-white' : 'text-gray-400 group-hover:text-purple-400'
                )}
              />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span
              className={cn(
                'truncate text-sm font-medium transition-colors duration-200 flex-1 text-left',
                location.pathname === '/notificacoes' ? 'text-white' : 'text-gray-400 group-hover:text-purple-300'
              )}
              title="Notificações"
            >
              Notificações
            </span>
            {unreadCount > 0 && location.pathname !== '/notificacoes' && (
              <span className="ml-auto text-[9px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleSignOut}
            className="group w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-purple-500/10 transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-purple-400 transition-colors duration-200" />
            <span className="truncate text-sm font-medium text-gray-400 group-hover:text-purple-300 transition-colors duration-200 flex-1 text-left" title="Sair do Sistema">
              Sair do Sistema
            </span>
          </button>
        </div>

      </nav>
  );
};
