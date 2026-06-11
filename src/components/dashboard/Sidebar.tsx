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
  Shield,
  Layers,
  Cpu
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

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    name: 'Service Desk',
    items: [
      { icon: Home, label: 'Início', path: '/' },
      { icon: Ticket, label: 'Tickets Abertos', path: '/novo-ticket' }, // Redireciona pro form mas atua como desk
      { icon: History, label: 'Histórico', path: '/historico' },
      { icon: BookOpen, label: 'Base de Conhecimento', path: '/knowledge' },
    ]
  },
  {
    name: 'Infraestrutura (RMM)',
    items: [
      { icon: Monitor, label: 'Monitoramento', path: '/monitoring', roles: ['admin', 'developer', 'technician'] },
      { icon: AlertTriangle, label: 'Alertas', path: '/alertas', roles: ['admin', 'developer', 'technician'] },
      { icon: Layers, label: 'Patches & Updates', path: '/patches', roles: ['admin', 'developer'] },
      { icon: Cpu, label: 'Ativos (CMDB)', path: '/assets', roles: ['admin', 'technician', 'developer'] },
    ]
  },
  {
    name: 'Gestão',
    items: [
      { icon: GitBranch, label: 'Automações', path: '/automacoes', roles: ['admin', 'developer'] },
      { icon: BarChart2, label: 'Relatórios', path: '/relatorios', roles: ['admin', 'developer'] },
    ]
  }
];

const bottomItems: NavItem[] = [
  { icon: Settings, label: 'Ajustes', path: '/ajustes' },
  { icon: Shield, label: 'Admin', path: '/admin', roles: ['admin', 'developer'] },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: role } = useUserRole();

  const renderItem = (item: NavItem, index: number) => {
    if (item.roles && (!role || !item.roles.includes(role))) return null;
    const isActive = location.pathname === item.path;

    return (
      <Tooltip key={item.path}>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate(item.path)}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 transform active:scale-95 group relative",
              isActive
                ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsla(var(--primary),0.3)]" 
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            )}
            aria-label={item.label}
          >
            <item.icon 
              className={cn(
                "w-5 h-5 transition-all duration-300",
                isActive ? "scale-110" : "group-hover:scale-110"
              )} 
            />
            {isActive && (
              <div className="absolute -left-2 w-1 h-6 bg-primary rounded-full shadow-[0_0_10px_hsla(var(--primary),0.8)]" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-sidebar-accent text-white border-sidebar-border font-medium text-[11px] px-3 py-1.5 shadow-xl">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="bg-sidebar-background h-screen w-20 flex flex-col items-center py-6 sticky top-0 border-r border-sidebar-border shadow-2xl z-50 overflow-hidden">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <div 
            onClick={() => navigate('/')}
            className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group transition-all duration-700 hover:rotate-[360deg] cursor-pointer"
          >
            <div className="w-5 h-5 bg-primary rounded-md shadow-[0_0_15px_hsla(var(--primary),0.5)] flex items-center justify-center">
              <span className="text-[10px] font-black text-white italic">O</span>
            </div>
          </div>
        </div>
        
        {/* Main Navigation (Grouped) */}
        <div className="flex flex-col items-center flex-1 w-full overflow-y-auto no-scrollbar scroll-smooth">
          {navGroups.map((group, groupIdx) => {
            const hasVisibleItems = group.items.some(i => !i.roles || (role && i.roles.includes(role)));
            if (!hasVisibleItems) return null;

            return (
              <div key={group.name} className="flex flex-col items-center w-full">
                {groupIdx > 0 && (
                  <div className="w-8 h-px bg-sidebar-border/50 my-3" />
                )}
                <div className="flex flex-col items-center gap-3 px-2 w-full">
                  {group.items.map(renderItem)}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Bottom Navigation */}
        <div className="flex flex-col items-center gap-4 mt-auto w-full px-2 pb-2 pt-6 border-t border-sidebar-border/30">
          {bottomItems.map(renderItem)}
        </div>
      </nav>
    </TooltipProvider>
  );
};
