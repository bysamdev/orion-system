import { 
  LayoutDashboard, 
  Ticket, 
  History, 
  BookOpen, 
  Package, 
  BarChart2, 
  Monitor, 
  FolderArchive, 
  Server, 
  ClipboardList, 
  FileCode, 
  ShieldCheck 
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
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Ticket, label: 'Novo Ticket', path: '/novo-ticket' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: BookOpen, label: 'Base de Conhecimento', path: '/knowledge' },
  { icon: Package, label: 'Ativos (CMDB)', path: '/assets', roles: ['admin', 'technician', 'developer'] },
  { icon: BarChart2, label: 'Relatórios', path: '/relatorios', roles: ['admin', 'developer'] },
  { icon: Monitor, label: 'Monitoramento', path: '/monitoring', roles: ['admin', 'developer', 'technician'] },
  { icon: FolderArchive, label: 'Arquivo', path: '/arquivo' },
  { icon: Server, label: 'Servidores', path: '/servidores' },
  { icon: ClipboardList, label: 'Projetos', path: '/projetos' },
];

const bottomItems: NavItem[] = [
  { icon: FileCode, label: 'API / Terminal', path: '/api' },
  { icon: ShieldCheck, label: 'Segurança', path: '/seguranca' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: role } = useUserRole();

  // Filtra itens baseado no role do usuário
  const filteredNavItems = navigationItems.filter(item => {
    if (!item.roles) return true;
    return role && item.roles.includes(role);
  });

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="bg-sidebar-background h-screen w-20 flex flex-col items-center py-6 sticky top-0 border-r border-sidebar-border shadow-2xl z-50 overflow-hidden">
        {/* Logo / Home Indicator */}
        <div className="mb-10 flex flex-col items-center">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group transition-all duration-700 hover:rotate-[360deg]">
            <div className="w-5 h-5 bg-primary rounded-md shadow-[0_0_15px_hsla(var(--primary),0.5)] flex items-center justify-center">
              <span className="text-[10px] font-black text-white italic">O</span>
            </div>
          </div>
        </div>
        
        {/* Main Navigation */}
        <div className="flex flex-col items-center gap-4 flex-1 w-full px-2 overflow-y-auto no-scrollbar scroll-smooth">
          {filteredNavItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 group relative",
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
                    
                    {/* Active Indicator Bar */}
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
          })}
        </div>
        
        {/* Bottom Navigation */}
        <div className="flex flex-col items-center gap-4 mt-auto w-full px-2 pb-6 pt-6 border-t border-sidebar-border/30">
          {bottomItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 group relative",
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
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-sidebar-accent text-white border-sidebar-border font-medium text-[11px] px-3 py-1.5 shadow-xl">
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
