import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Loader2,
  HandHelping,
  User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTechnicianStats, useTechnicianWorkload, useUnassignedTickets } from '@/hooks/useTechnicianStats';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TicketsTable } from './TicketsTable';
import { InProgressTickets } from './InProgressTickets';
import { ClosedTickets } from './ClosedTickets';
import { useUserProfile } from '@/hooks/useUserRole';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, variant = 'default', description }) => {
  const variantStyles = {
    default: 'bg-card border-border',
    warning: 'bg-warning/10 border-warning/30',
    success: 'bg-success/10 border-success/30',
    danger: 'bg-destructive/10 border-destructive/30',
  };

  const iconStyles = {
    default: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    danger: 'text-destructive',
  };

  return (
    <Card className={`${variantStyles[variant]} border`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`p-3 rounded-full bg-background ${iconStyles[variant]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useUserProfile();

  const { data: stats, isLoading: statsLoading } = useTechnicianStats(user?.id);
  const { data: workload, isLoading: workloadLoading } = useTechnicianWorkload(user?.id);
  const { data: unassignedTickets, isLoading: unassignedLoading } = useUnassignedTickets();

  const handleAssumeTicket = async (ticketId: string) => {
    if (!profile?.full_name) {
      toast({
        title: 'Erro',
        description: 'Perfil não encontrado',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          assigned_to: profile.full_name,
          status: 'in-progress'
        })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Ticket assumido com sucesso!',
      });

      queryClient.invalidateQueries({ queryKey: ['unassigned-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['technician-stats'] });
      queryClient.invalidateQueries({ queryKey: ['technician-workload'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch (error) {
      console.error('Erro ao assumir ticket:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível assumir o ticket',
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      urgent: 'bg-destructive/10 text-destructive border-destructive/30',
      high: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
      medium: 'bg-warning/10 text-warning border-warning/30',
      low: 'bg-muted text-muted-foreground border-border',
    };
    const labels = {
      urgent: 'Urgente',
      high: 'Alta',
      medium: 'Média',
      low: 'Baixa',
    };
    return (
      <Badge variant="outline" className={styles[priority as keyof typeof styles] || styles.medium}>
        {labels[priority as keyof typeof labels] || priority}
      </Badge>
    );
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Pessoais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Em Atendimento"
          value={stats?.inProgress || 0}
          icon={<PlayCircle className="w-6 h-6" />}
          variant="default"
          description="Tickets em andamento"
        />
        <StatCard
          title="Resolvidos Hoje"
          value={stats?.resolvedToday || 0}
          icon={<CheckCircle2 className="w-6 h-6" />}
          variant="success"
          description="Finalizados nas últimas 24h"
        />
        <StatCard
          title="SLA em Risco"
          value={stats?.slaAtRisk || 0}
          icon={<AlertTriangle className="w-6 h-6" />}
          variant={stats?.slaAtRisk && stats.slaAtRisk > 0 ? 'danger' : 'default'}
          description="Prazo < 4 horas"
        />
        <StatCard
          title="Meus Pendentes"
          value={stats?.pending || 0}
          icon={<Clock className="w-6 h-6" />}
          variant="warning"
          description="Aguardando ação"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal - Tickets */}
        <div className="lg:col-span-2 space-y-6">
          <TicketsTable />
          <InProgressTickets />
          <ClosedTickets />
        </div>

        {/* Sidebar - Carga de Trabalho e Fila */}
        <div className="space-y-6">
          {/* Gráfico de Carga de Trabalho */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Minha Carga de Trabalho
              </CardTitle>
              <CardDescription>Distribuição por status</CardDescription>
            </CardHeader>
            <CardContent>
              {workloadLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : workload && workload.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={workload}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {workload.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mb-2 text-success" />
                  <p className="text-sm">Nenhum ticket pendente!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fila Geral - Não Atribuídos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <HandHelping className="w-5 h-5 text-primary" />
                Fila Geral
              </CardTitle>
              <CardDescription>Tickets aguardando atribuição</CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : unassignedTickets && unassignedTickets.length > 0 ? (
                <div className="space-y-3">
                  {unassignedTickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <button
                            onClick={() => navigate(`/ticket/${ticket.id}`)}
                            className="text-sm font-medium text-foreground hover:text-primary truncate block text-left w-full"
                          >
                            #{ticket.ticket_number} - {ticket.title}
                          </button>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {getPriorityBadge(ticket.priority)}
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(ticket.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {ticket.requester_name}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssumeTicket(ticket.id)}
                          className="shrink-0"
                        >
                          Assumir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mb-2 text-success" />
                  <p className="text-sm">Nenhum ticket na fila!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
