import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { TopBar } from './TopBar';
import { QuickAccessCard } from './QuickAccessCard';
import { CustomerTicketsTable } from './CustomerTicketsTable';
import { TechnicianDashboard } from './TechnicianDashboard';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

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
  // Admin e técnico agora veem a mesma interface de gerenciamento de chamados
  const hasManagementAccess = role === 'technician' || role === 'admin' || role === 'developer';

  if (isCustomer) {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        <DashboardHeader userName={userName} />
        
        {hasManagementAccess ? (
          // Técnico e Admin: Cockpit Operacional com lista de chamados
          <TechnicianDashboard />
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
