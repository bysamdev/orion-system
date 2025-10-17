import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { TicketsTable } from './TicketsTable';
import { TopBar } from './TopBar';
import { ClosedTickets } from './ClosedTickets';
import { StatsReport } from './StatsReport';
import { QuickStats } from './QuickStats';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile, isLoading: profileLoading } = useUserProfile();

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

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        <DashboardHeader userName={userName} />
        
        {isCustomer ? (
          // Colaborador: Ver apenas seus próprios chamados
          <div className="space-y-6">
            <TicketsTable />
          </div>
        ) : (
          // Técnico e Gestor: Ver todos os chamados e métricas
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <TicketsTable />
              <ClosedTickets />
            </div>
            
            {isGestor && (
              <div className="space-y-6">
                <StatsReport />
                <QuickStats />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
