import { 
  Home, 
  Ticket, 
  History, 
  BookOpen, 
  Package, 
  BarChart2, 
  Monitor, 
  AlertTriangle,
  GitBranch,
  Settings, 
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[];
}

const navigationItems: NavItem[] = [
  { icon: Home, label: 'Início', path: '/' },
  { icon: Ticket, label: 'Novo Ticket', path: '/novo-ticket' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: BookOpen, label: 'Base de Conhecimento', path: '/knowledge' },
  { icon: Package, label: 'Ativos (CMDB)', path: '/assets', roles: ['admin', 'technician', 'developer'] },
  { icon: BarChart2, label: 'Relatórios', path: '/relatorios', roles: ['admin', 'developer'] },
  { icon: Monitor, label: 'Monitoramento', path: '/monitoring', roles: ['admin', 'developer', 'technician'] },
  { icon: AlertTriangle, label: 'Alertas', path: '/alertas', roles: ['admin', 'developer', 'technician'] },
  { icon: GitBranch, label: 'Automações', path: '/automacoes', roles: ['admin', 'developer'] },
  { icon: Package, label: 'Patches', path: '/patches', roles: ['admin', 'developer'] },
];

const bottomItems: NavItem[] = [
  { icon: Settings, label: 'Ajustes', path: '/ajustes' },
  { icon: Shield, label: 'Admin', path: '/admin', roles: ['admin', 'developer'] },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: role } = useUserRole();

  const filteredNavItems = navigationItems.filter(item => {
    if (!item.roles) return true;
    return role && item.roles.includes(role);
  });

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="bg-sidebar-background h-screen w-[72px] flex flex-col items-center py-6 sticky top-0 border-r border-sidebar-border z-50 overflow-hidden">
        {/* Technical Logo Indicator */}
        <div className="mb-10 w-full flex justify-center">
          <div className="w-10 h-10 bg-black border border-primary/40 flex items-center justify-center relative group cursor-pointer" onClick={() => navigate('/')}>
            {/* Tech crosshairs */}
            <div className="absolute -top-[1px] -left-[1px] w-1.5 h-1.5 border-t border-l border-primary/80" />
            <div className="absolute -top-[1px] -right-[1px] w-1.5 h-1.5 border-t border-r border-primary/80" />
            <div className="absolute -bottom-[1px] -left-[1px] w-1.5 h-1.5 border-b border-l border-primary/80" />
            <div className="absolute -bottom-[1px] -right-[1px] w-1.5 h-1.5 border-b border-r border-primary/80" />
            
            <span className="font-mono text-lg font-bold text-primary">O</span>
          </div>
        </div>
        
        {/* Main Navigation */}
        <div className="flex flex-col items-center gap-2 flex-1 w-full px-2 overflow-y-auto no-scrollbar scroll-smooth">
          {filteredNavItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "w-full h-11 flex items-center justify-center relative transition-colors group",
                      isActive
                        ? "bg-sidebar-accent text-primary" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                    aria-label={item.label}
                  >
                    <item.icon 
                      className="w-5 h-5" 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    
                    {/* Hard Active Edge */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-sidebar-accent text-foreground border-sidebar-border font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-sm">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        
        {/* Bottom Navigation */}
        <div className="flex flex-col items-center gap-2 mt-auto w-full px-2 pt-6 border-t border-sidebar-border">
          {bottomItems.filter(item => !item.roles || (role && item.roles.includes(role))).map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "w-full h-11 flex items-center justify-center relative transition-colors group",
                      isActive
                        ? "bg-sidebar-accent text-primary" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                    aria-label={item.label}
                  >
                    <item.icon 
                      className="w-5 h-5" 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-sidebar-accent text-foreground border-sidebar-border font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-sm">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
};
