import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  userName?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName = "Samuel Terres"
}) => {
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentHour = currentDate.getHours();
  
  const greeting = currentHour < 12 
    ? 'Bom dia' 
    : currentHour < 18 
      ? 'Boa tarde' 
      : 'Boa noite';

  const dateString = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Cockpit Operacional
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground capitalize font-medium">{dateString}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
          {greeting}, <span className="text-primary">{userName}</span> 👋
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/sistemas')}
          className="rounded-xl border-border/50 text-xs font-semibold gap-1.5 hover:bg-muted/60"
        >
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="hidden sm:inline">Supervisão</span> RMM
        </Button>
        <Button
          size="sm"
          onClick={() => navigate('/novo-ticket')}
          className="rounded-xl text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Chamado
        </Button>
      </div>
    </header>
  );
};