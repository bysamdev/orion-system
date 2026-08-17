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
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 p-4 sm:p-8 lg:p-12 max-w-[1200px] mx-auto w-full space-y-8 sm:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Sessão de Boas-vindas: Foco em ação rápida de abertura de chamado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
              Olá, {firstName}!
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg font-medium">
              Como podemos ajudar você hoje?
            </p>
          </div>
          <ButtonPrimary 
            onClick={() => navigate('/novo-ticket')}
            className="h-12 sm:h-14 px-6 sm:px-8 rounded-2xl font-bold shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 text-base sm:text-lg"
            icon={<Plus className="w-5 h-5 sm:w-6 sm:h-6" />}
          >
            Abrir Novo Chamado
          </ButtonPrimary>
        </div>

        {/* SEÇÃO DE DESTAQUE: Chamados Abertos / Em Andamento */}
        {openTickets.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {openTickets.length === 1 ? '1 Chamado em Andamento' : `${openTickets.length} Chamados em Andamento`}
                  </span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/historico')}
              >
                Ver histórico completo <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className={cn(
              "grid gap-4",
              openTickets.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
            )}>
              {openTickets.map((ticket) => {
                const isAwaitingCustomer = ticket.status === 'awaiting-customer';
                const isResolved = ticket.status === 'resolved';
                const isInProgress = ticket.status === 'in-progress';

                return (
                  <Card 
                    key={ticket.id} 
                    className={cn(
                      "group border transition-all duration-300 cursor-pointer overflow-hidden relative rounded-2xl shadow-sm hover:shadow-xl",
                      isAwaitingCustomer 
                        ? "border-purple-500/50 bg-gradient-to-br from-purple-500/10 via-card to-background shadow-purple-500/5 hover:border-purple-500" 
                        : isResolved
                        ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 via-card to-background shadow-emerald-500/5 hover:border-emerald-500"
                        : isInProgress
                        ? "border-blue-500/40 bg-gradient-to-br from-blue-500/5 via-card to-background hover:border-blue-500/70"
                        : "border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40"
                    )}
                    onClick={() => navigate(`/ticket/${ticket.id}`)}
                  >
                    {/* Faixa superior contextual */}
                    <div className={cn(
                      "px-5 py-2 text-[11px] font-bold flex items-center justify-between border-b",
                      isAwaitingCustomer 
                        ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20"
                        : isResolved
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : isInProgress
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/15"
                        : "bg-muted/40 text-muted-foreground border-border/40"
                    )}>
                      <div className="flex items-center gap-1.5">
                        {isAwaitingCustomer && <AlertCircle className="w-3.5 h-3.5 animate-bounce text-purple-600 dark:text-purple-400" />}
                        {isResolved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                        {isInProgress && <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                        <span>
                          {isAwaitingCustomer 
                            ? 'O suporte técnico aguarda sua resposta!'
                            : isResolved 
                            ? 'Chamado resolvido pelo técnico. Verifique a solução.'
                            : isInProgress 
                            ? `Em atendimento por ${ticket.assigned_to || 'técnico'}`
                            : 'Chamado aberto na fila de espera'}
                        </span>
                      </div>
                      <span className="font-mono text-xs opacity-75 font-bold">
                        #{ticket.ticket_number}
                      </span>
                    </div>

                    <CardContent className="p-5 sm:p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
                            {ticket.title}
                          </h3>
                          {ticket.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {ticket.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Badges e Metadados */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        {ticket.category && (
                          <span className="text-[11px] font-medium bg-muted px-2.5 py-0.5 rounded-md text-muted-foreground">
                            {ticket.category}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(ticket.created_at)}
                        </span>
                      </div>

                      {/* Botão de Ação Destacado */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span>
                            {ticket.assigned_to ? `Responsável: ${ticket.assigned_to}` : 'Aguardando atribuição'}
                          </span>
                        </div>

                        {isAwaitingCustomer ? (
                          <Button 
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 rounded-xl shadow-md shadow-purple-600/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ticket/${ticket.id}`);
                            }}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Responder Agora
                          </Button>
                        ) : isResolved ? (
                          <Button 
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-xl shadow-md shadow-emerald-600/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ticket/${ticket.id}`);
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Conferir Resolução
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="font-bold gap-1.5 rounded-xl group-hover:translate-x-0.5 transition-transform"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ticket/${ticket.id}`);
                            }}
                          >
                            Acompanhar Chamado
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Atalhos Rápidos: Acesso ao histórico, Wiki e Suporte Humano */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="group border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer bg-card/50 backdrop-blur-sm overflow-hidden" 
            onClick={() => navigate('/historico')}
          >
            <CardContent className="p-4 sm:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
                <History className="w-6 h-6 xl:w-8 xl:h-8 text-primary" />
              </div>
              <div className="min-w-0 sm:min-w-[160px] flex-1 space-y-1">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight sm:truncate">Meus Chamados</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Acompanhe o status e histórico de todas as suas solicitações.</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer bg-card/50 backdrop-blur-sm overflow-hidden" 
            onClick={() => navigate('/conhecimento')}
          >
            <CardContent className="p-4 sm:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-secondary/10 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
                <Book className="w-6 h-6 xl:w-8 xl:h-8 text-secondary-foreground" />
              </div>
              <div className="min-w-0 sm:min-w-[160px] flex-1 space-y-1">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight sm:truncate">Base de Conhecimento</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Tire suas dúvidas e encontre soluções rápidas.</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer bg-card/50 backdrop-blur-sm overflow-hidden" 
            onClick={() => navigate('/novo-ticket')}
          >
            <CardContent className="p-4 sm:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-warning/10 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
                <MessageSquare className="w-6 h-6 xl:w-8 xl:h-8 text-warning" />
              </div>
              <div className="min-w-0 sm:min-w-[160px] flex-1 space-y-1">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight sm:truncate">Falar com Consultor</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Abra um chamado e fale diretamente com a equipe de suporte.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Destaques da Central de Ajuda */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black tracking-tight">Destaques da Ajuda</h2>
          <div className="space-y-4">
            <Card className="group bg-gradient-to-br from-primary/5 to-transparent border-primary/20 cursor-pointer" onClick={() => navigate('/conhecimento')}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Badge className="bg-primary text-primary-foreground font-black text-[9px] uppercase">Dica</Badge>
                    <h4 className="text-lg font-bold">Guia de Uso Orion</h4>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Aprenda a abrir chamados eficientes e como utilizar o <strong>TeamViewer</strong> para liberar o acesso remoto do suporte técnico.
                </p>
                <Button variant="link" className="p-0 h-auto font-bold text-primary gap-2">
                  Acessar Guia do Usuário <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

      </main>
    </div>
  );
}

