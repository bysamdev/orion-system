import React from 'react';
import { BarChart3, Ticket, Archive, Server, Briefcase, Cloud, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}

const navigationItems: NavItem[] = [
  { icon: BarChart3, label: 'Dashboard', active: true },
  { icon: Ticket, label: 'Tickets', active: false },
  { icon: Archive, label: 'Arquivo', active: false },
  { icon: Server, label: 'Servidores', active: false },
  { icon: Briefcase, label: 'Projetos', active: false },
];

const bottomItems: NavItem[] = [
  { icon: Cloud, label: 'API' },
  { icon: Shield, label: 'Segurança' },
];

export const Sidebar: React.FC = () => {
  return (
    <nav className="bg-sidebar-background h-screen w-32 flex flex-col items-center py-8 px-4 sticky top-0">
      <div className="mb-8">
        <h2 className="text-sidebar-foreground text-sm font-semibold">Dashboard</h2>
      </div>
      
      <div className="flex flex-col gap-6 flex-1">
        {navigationItems.map((item, index) => (
          <button
            key={index}
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200",
              item.active 
                ? "bg-sidebar-primary shadow-lg shadow-sidebar-primary/20" 
                : "bg-sidebar-accent hover:bg-sidebar-primary/10"
            )}
            aria-label={item.label}
          >
            <item.icon 
              className={cn(
                "w-7 h-7",
                item.active ? "text-sidebar-primary-foreground" : "text-sidebar-accent-foreground"
              )} 
            />
          </button>
        ))}
      </div>
      
      <div className="flex flex-col gap-6 mt-auto">
        {bottomItems.map((item, index) => (
          <button
            key={index}
            className="w-16 h-16 rounded-2xl bg-sidebar-accent hover:bg-sidebar-primary/10 flex items-center justify-center transition-all duration-200"
            aria-label={item.label}
          >
            <item.icon className="w-7 h-7 text-sidebar-accent-foreground" />
          </button>
        ))}
      </div>
    </nav>
  );
};
