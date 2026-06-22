import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Ticket, Book, History, Search, 
  ChevronRight, MessageSquare, LifeBuoy, 
  ExternalLink, ArrowRight, Loader2
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useMeusTickets } from '@/hooks/useMyTickets';

const ClientPortal = () => {
  const navigate = useNavigate();
  // Buscamos o perfil detalhado para saudar o usuário pelo nome.
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const [search, setSearch] = useState('');

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Hook centralizado para buscar os 5 chamados recentes do usuário.
  const { data: recentTicketsData } = useMeusTickets(profile?.id, 'customer', {
    statusIn: ['open', 'in-progress', 'awaiting-customer'],
    limit: 5
  });
  const recentTickets = recentTicketsData?.data;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      
      <main className="flex-1 p-8 lg:p-12 max-w-[1200px] mx-auto w-full space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Sessão de Boas-vindas: Foco em ação rápida de abertura de chamado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-foreground">Olá, {profile?.full_name?.split(' ')[0]}!</h1>
            <p className="text-muted-foreground text-lg font-medium">Como podemos ajudar você hoje?</p>
          </div>
          <Button 
            onClick={() => navigate('/novo-ticket')}
            className="h-14 px-8 rounded-2xl font-bold gap-3 shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 text-lg"
          >
            <Plus className="w-6 h-6" /> Abrir Novo Chamado
          </Button>
        </div>

        {/* Atalhos Rápidos: Acesso ao histórico, Wiki e Suporte Humano */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="group border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer bg-card/50 backdrop-blur-sm overflow-hidden" onClick={() => navigate('/historico')}>
            <CardContent className="p-6 xl:p-8 flex items-center gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
                <History className="w-6 h-6 xl:w-8 xl:h-8 text-primary" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight">Meus Chamados</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Acompanhe o status das suas solicitações.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer bg-card/50 backdrop-blur-sm overflow-hidden" onClick={() => navigate('/knowledge')}>
            <CardContent className="p-6 xl:p-8 flex items-center gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-secondary/10 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
                <Book className="w-6 h-6 xl:w-8 xl:h-8 text-secondary-foreground" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight">Base de Conhecimento</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Tire suas dúvidas e encontre soluções.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer bg-card/50 backdrop-blur-sm overflow-hidden" onClick={() => navigate('/novo-ticket')}>
            <CardContent className="p-6 xl:p-8 flex items-center gap-4 xl:gap-6">
              <div className="p-3 xl:p-4 bg-warning/10 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
                <MessageSquare className="w-6 h-6 xl:w-8 xl:h-8 text-warning" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-base lg:text-lg xl:text-xl font-bold leading-tight">Falar com Consultor</h3>
                <p className="text-xs xl:text-sm text-muted-foreground line-clamp-2">Abra um chamado e fale com a equipe de suporte.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Listagem de Atividade Recente: Facilita o retorno a chamados em aberto */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight">Atividade Recente</h2>
              <Button variant="ghost" size="sm" className="font-bold gap-2 text-primary" onClick={() => navigate('/historico')}>
                Ver todos <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {recentTickets?.map((ticket) => (
                <Card key={ticket.id} className="border-border/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-colors cursor-pointer" onClick={() => navigate(`/ticket/${ticket.id}`)}>
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-2 rounded-xl",
                        ticket.status === 'open' ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
                      )}>
                        <Ticket className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold leading-tight">{ticket.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">#{ticket.ticket_number} • {ticket.status}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              ))}
              {recentTickets?.length === 0 && (
                <div className="h-40 flex flex-col items-center justify-center border border-dashed border-border/60 rounded-3xl opacity-40">
                  <LifeBuoy className="w-10 h-10 mb-2" />
                  <p className="font-bold">Nenhum chamado aberto</p>
                </div>
              )}
            </div>
          </div>

          {/* Destaques da Central de Ajuda: Promoção de conteúdos de autoatendimento */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black tracking-tight">Destaques da Ajuda</h2>
            <div className="space-y-4">
              <Card className="group bg-gradient-to-br from-primary/5 to-transparent border-primary/20 cursor-pointer" onClick={() => navigate('/tutorial')}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Badge className="bg-primary text-primary-foreground font-black text-[9px] uppercase">Dica</Badge>
                      <h4 className="text-lg font-bold">Guia de Uso Orion</h4>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Aprenda a abrir chamados eficientes e como utilizar o AnyDesk para suporte remoto.
                  </p>
                  <Button variant="link" className="p-0 h-auto font-bold text-primary gap-2">
                    Acessar Guia do Usuário <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClientPortal;
