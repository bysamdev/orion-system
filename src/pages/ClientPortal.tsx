import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Ticket, Book, History, Search, 
  ChevronRight, MessageSquare, LifeBuoy, 
  ExternalLink, ArrowRight, Loader2, Clock, User, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { useProfilesMap, resolveUserDisplayName } from '@/hooks/useUserDisplayName';

interface PortalTicket {
  id: string;
  ticket_number: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  assigned_to?: string | null;
  assigned_to_user_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export default function ClientPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { profilesMap } = useProfilesMap();
  const { data: role } = useUserRole();
  const isStaff = role === 'technician' || role === 'admin' || role === 'developer';

  // Subscrição em tempo real para mudanças em tickets
  useRealtimeTickets();

  // Busca todos os chamados abertos/em andamento do cliente logado (enquanto não estiverem fechados/cancelados)
  const { data: openTickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['portal-open-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['open', 'in-progress', 'awaiting-customer', 'awaiting-third-party', 'reopened', 'resolved'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PortalTicket[];
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const formatTimeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { locale: ptBR, addSuffix: true });
    } catch {
      return '';
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="w-full flex flex-col space-y-6">
      <div className="flex-1 w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Sessão de Boas-vindas padronizada */}
        <PageHeader
          icon={LifeBuoy}
          badge="PORTAL DE SUPORTE"
          title={`Olá, ${firstName}!`}
          description="Como podemos ajudar você hoje? Acompanhe seus atendimentos ou abra uma nova solicitação."
          actions={
            <ButtonPrimary 
              onClick={() => navigate('/novo-ticket')}
              className="h-12 px-6 rounded-lg font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              icon={<Plus className="w-5 h-5" />}
            >
              Abrir Novo Chamado
            </ButtonPrimary>
          }
        />

        {/* Atalhos Rápidos: Acesso ao histórico, Wiki e Suporte Humano */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="group border border-border/40 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer bg-card rounded-3xl overflow-hidden shadow-sm" 
            onClick={() => navigate('/historico')}
          >
            <CardContent className="p-4 sm:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-primary/10 border border-primary/20 rounded-2xl group-hover:scale-105 transition-transform shrink-0">
                <History className="w-6 h-6 xl:w-8 xl:h-8 text-primary" />
              </div>
              <div className="min-w-0 sm:min-w-[160px] flex-1 space-y-1">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight sm:truncate">Meus Chamados</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Acompanhe o status e histórico de todas as suas solicitações.</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group border border-border/40 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer bg-card rounded-3xl overflow-hidden shadow-sm" 
            onClick={() => navigate('/conhecimento')}
          >
            <CardContent className="p-4 sm:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-secondary/15 border border-border/30 rounded-2xl group-hover:scale-105 transition-transform shrink-0">
                <Book className="w-6 h-6 xl:w-8 xl:h-8 text-secondary-foreground" />
              </div>
              <div className="min-w-0 sm:min-w-[160px] flex-1 space-y-1">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight sm:truncate">Base de Conhecimento</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Tire suas dúvidas e encontre soluções rápidas.</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group border border-border/40 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer bg-card rounded-3xl overflow-hidden shadow-sm" 
            onClick={() => navigate('/novo-ticket')}
          >
            <CardContent className="p-4 sm:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-warning/15 border border-warning/30 rounded-2xl group-hover:scale-105 transition-transform shrink-0">
                <MessageSquare className="w-6 h-6 xl:w-8 xl:h-8 text-warning" />
              </div>
              <div className="min-w-0 sm:min-w-[160px] flex-1 space-y-1">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight sm:truncate">Falar com Consultor</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Abra um chamado e fale diretamente com a equipe de suporte.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SEÇÃO DE DESTAQUE COMPACTA: Chamados em Andamento (Abaixo dos atalhos) */}
        {openTickets.length > 0 ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Chamados em Andamento
                </h2>
                <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5 rounded-full">
                  {openTickets.length}
                </Badge>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs font-bold gap-1 text-muted-foreground hover:text-foreground h-8 rounded-xl"
                onClick={() => navigate('/historico')}
              >
                Ver histórico completo <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="space-y-2.5">
              {openTickets.map((ticket) => {
                const isAwaitingCustomer = ticket.status === 'awaiting-customer';
                const isResolved = ticket.status === 'resolved';
                const isInProgress = ticket.status === 'in-progress';
                return (
                  <Card 
                    key={ticket.id} 
                    className={cn(
                      "group border transition-all duration-200 cursor-pointer overflow-hidden rounded-2xl bg-card shadow-sm hover:border-primary/40 hover:shadow-md",
                      isAwaitingCustomer 
                        ? "border-primary/50 bg-primary/5 hover:border-primary" 
                        : isResolved
                        ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500"
                        : isInProgress
                        ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60"
                        : "border-border/40 hover:border-primary/40"
                    )}
                    onClick={() => navigate(`/ticket/${ticket.id}`)}
                  >
                    <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "p-2.5 rounded-xl border flex-shrink-0",
                          isAwaitingCustomer ? "bg-primary/10 text-primary border-primary/20" :
                          isResolved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                          isInProgress ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                          "bg-primary/10 text-primary border-primary/20"
                        )}>
                          <Ticket className="w-4 h-4" />
                        </div>
                        
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              #{ticket.ticket_number}
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {ticket.title}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <StatusBadge status={ticket.status as any} />
                            <PriorityBadge priority={ticket.priority as any} />
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        {isAwaitingCustomer ? (
                          <Button 
                            size="sm"
                            className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 rounded-xl shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ticket/${ticket.id}`);
                            }}
                          >
                            <MessageSquare className="w-3 h-3" />
                            Responder
                          </Button>
                        ) : isResolved ? (
                          <Button 
                            size="sm"
                            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 rounded-xl shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ticket/${ticket.id}`);
                            }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Avaliar & Concluir
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 px-3 text-xs font-semibold gap-1 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ticket/${ticket.id}`);
                            }}
                          >
                            Acompanhar
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <Card className="border border-border/40 bg-card/60 backdrop-blur-sm rounded-2xl p-6 text-center shadow-xs">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Tudo em dia!</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Você não possui nenhum chamado em andamento no momento. Precisa de suporte ou reportar um problema?
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold rounded-xl gap-1.5 mt-2 hover:border-primary/40 hover:bg-primary/5"
                onClick={() => navigate('/novo-ticket')}
              >
                <Plus className="w-3.5 h-3.5" />
                Abrir Novo Chamado
              </Button>
            </div>
          </Card>
        )}

        {/* Destaques da Central de Ajuda */}
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-bold tracking-tight">Destaques da Ajuda</h2>
          <div className="space-y-4">
            <Card className="group bg-gradient-to-br from-primary/5 to-transparent border-primary/20 cursor-pointer" onClick={() => navigate('/conhecimento')}>
              <CardContent className="p-5 sm:p-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Badge className="bg-primary text-primary-foreground font-black text-[9px] uppercase">Dica</Badge>
                    <h4 className="text-base sm:text-lg font-bold">Guia de Uso Orion</h4>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Aprenda a abrir chamados eficientes e como utilizar o <strong>TeamViewer</strong> para liberar o acesso remoto do suporte técnico.
                </p>
                <Button variant="link" className="p-0 h-auto font-bold text-primary gap-1 text-xs sm:text-sm">
                  Acessar Guia do Usuário <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}

