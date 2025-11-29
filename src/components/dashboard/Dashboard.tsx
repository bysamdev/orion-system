import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { TicketsTable } from './TicketsTable';
import { TopBar } from './TopBar';
import { InProgressTickets } from './InProgressTickets';
import { ClosedTickets } from './ClosedTickets';
import { StatsReport } from './StatsReport';
import { QuickStats } from './QuickStats';
import { TrendChart } from './TrendChart';
import { NeedsAttention } from './NeedsAttention';
import { QuickAccessCard } from './QuickAccessCard';
import { CustomerTicketsTable } from './CustomerTicketsTable';
import { TechnicianDashboard } from './TechnicianDashboard';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { Loader2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  
  // Enable real-time notifications
  useRealtimeTickets();

  if (roleLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = profile?.full_name || 'Usuário';
  const isCustomer = role === 'customer';
  const isGestor = role === 'admin';
  const isTechnician = role === 'technician';
  
  // Restringir acesso: apenas técnicos, admins e developers têm acesso ao painel de gerenciamento
  const hasManagementAccess = isTechnician || isGestor || role === 'developer';

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        <DashboardHeader userName={userName} />
        
        {isCustomer ? (
          // Portal do Usuário: Interface simplificada de autoatendimento
          <div className="space-y-6">
            {/* Card de Acesso Rápido */}
            <QuickAccessCard />
            
            {/* Chamados em Aberto */}
            <CustomerTicketsTable 
              filter="open" 
              title="Meus Chamados em Aberto"
              emptyMessage="Você não possui chamados em aberto no momento."
            />
            
            {/* Chamados Finalizados */}
            <CustomerTicketsTable 
              filter="closed" 
              title="Histórico de Chamados"
              emptyMessage="Você ainda não possui chamados finalizados."
            />
          </div>
        ) : isTechnician ? (
          // Técnico: Cockpit Operacional personalizado
          <TechnicianDashboard />
        ) : isGestor ? (
          // Gestor: Ver todos os chamados e métricas (painel de gerenciamento)
          <div className="space-y-6">
            <QuickStats />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <TicketsTable />
                <InProgressTickets />
                <ClosedTickets />
              </div>
              
              <div className="space-y-6">
                <StatsReport />
                <TrendChart days={7} />
                <NeedsAttention />
              </div>
            </div>
          </div>
        ) : (
          // Acesso negado para outros roles
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Acesso Restrito</p>
              <p className="text-sm text-muted-foreground">Você não tem permissão para acessar o painel de gerenciamento.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
