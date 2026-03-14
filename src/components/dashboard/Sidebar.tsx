import { BarChart3, Ticket, Archive, Server, Briefcase, Cloud, Shield, PieChart, Monitor, Book, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[]; // Se definido, só mostra para esses roles
}

const navigationItems: NavItem[] = [
  { icon: BarChart3, label: 'Dashboard', path: '/' },
  { icon: Ticket, label: 'Novo Ticket', path: '/novo-ticket' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: Book, label: 'Base de Conhecimento', path: '/knowledge' },
  { icon: PieChart, label: 'Relatórios', path: '/relatorios', roles: ['admin', 'developer'] },
  { icon: Monitor, label: 'Monitoramento', path: '/monitoring', roles: ['admin', 'developer', 'technician'] },
  { icon: Archive, label: 'Arquivo', path: '/arquivo' },
  { icon: Server, label: 'Servidores', path: '/servidores' },
  { icon: Briefcase, label: 'Projetos', path: '/projetos' },
];

const bottomItems: NavItem[] = [
  { icon: Cloud, label: 'API', path: '/api' },
  { icon: Shield, label: 'Segurança', path: '/seguranca' },
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
    <nav className="bg-sidebar-background h-screen w-32 flex flex-col items-center py-8 sticky top-0">
      <div className="mb-12">
        <h2 className="text-sidebar-foreground text-xs font-semibold text-center">Dashboard</h2>
      </div>
      
      <div className="flex flex-col items-center gap-6 flex-1 w-full px-4">
        {filteredNavItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 flex-shrink-0",
                isActive
                  ? "bg-sidebar-primary shadow-lg shadow-sidebar-primary/20" 
                  : "bg-sidebar-accent hover:bg-sidebar-primary/10"
              )}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon 
                className={cn(
                  "w-7 h-7",
                  isActive ? "text-sidebar-primary-foreground" : "text-sidebar-accent-foreground"
                )} 
              />
            </button>
          );
        })}
      </div>
      
      <div className="flex flex-col items-center gap-6 mt-auto w-full px-4 pb-4">
        {bottomItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 flex-shrink-0",
                isActive
                  ? "bg-sidebar-primary shadow-lg shadow-sidebar-primary/20"
                  : "bg-sidebar-accent hover:bg-sidebar-primary/10"
              )}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon 
                className={cn(
                  "w-7 h-7",
                  isActive ? "text-sidebar-primary-foreground" : "text-sidebar-accent-foreground"
                )} 
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
