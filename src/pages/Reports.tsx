import React from 'react';
import { TopBar } from '@/components/dashboard/TopBar';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Reports: React.FC = () => {
  const { data: role, isLoading } = useUserRole();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Apenas admins e developers podem acessar relatórios
  const canAccessReports = role === 'admin' || role === 'developer';

  if (!canAccessReports) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
          <TopBar />
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Acesso Restrito</p>
              <p className="text-sm text-muted-foreground">Você não tem permissão para acessar os relatórios.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />
        
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Relatórios e Estatísticas</h1>
          <p className="text-muted-foreground mt-1">Visualize KPIs e gráficos de performance</p>
        </div>
        
        <AdminDashboard />
      </main>
    </div>
  );
};

export default Reports;
