import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2, Search, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTechnicianStats, useTechnicianWorkload, useTeamWorkload } from '@/hooks/useTechnicianStats';
import { useMyActiveTickets, useSLAAtRiskTickets, useUnassignedTicketsEnhanced, useAllActiveTickets, useMyRecentClosedTickets, useActiveAgentsCount } from '@/hooks/useMyTickets';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { useAssumeTicket } from '@/hooks/useTickets';
import { useFiltrosDoPainel } from './tecnico/useFiltrosDoPainel';
import { Indicadores, Indicador } from './tecnico/Indicadores';
import { CargaDaEquipe } from './tecnico/CargaDaEquipe';
import { FiltrosAvancados } from './tecnico/FiltrosAvancados';
import { AbasDeChamados } from './tecnico/AbasDeChamados';
import { LateralDoTecnico } from './tecnico/LateralDoTecnico';
import { SeletorDeModo } from './tecnico/SeletorDeModo';
import { useModoDoPainel, ModoDoPainel } from './tecnico/useModoDoPainel';
import { ModoLista, Recorte } from './tecnico/ModoLista';

const RECORTE_DA_ABA: Record<string, Recorte> = {
  'unassigned': 'fila',
  'my-tickets': 'meus',
  'all-tickets': 'todos',
};

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();

  const { data: stats, isLoading: statsLoading } = useTechnicianStats(user?.id, role);
  const { data: workload } = useTechnicianWorkload(user?.id, role);
  const { data: myTickets = [], isLoading: myTicketsLoading } = useMyActiveTickets(user?.id);
  const { data: allActiveTickets = [], isLoading: allTicketsLoading } = useAllActiveTickets();
  useSLAAtRiskTickets();
  const { data: unassigned = [], isLoading: unassignedLoading } = useUnassignedTicketsEnhanced();
  const { data: recentClosed = [] } = useMyRecentClosedTickets(user?.id);
  const { data: activeAgentsCount } = useActiveAgentsCount(profile?.company_id);

  const { data: teamWorkload } = useTeamWorkload(profile?.company_id);
  const assumeTicket = useAssumeTicket();

  const filtros = useFiltrosDoPainel(unassigned, myTickets, allActiveTickets);
  const { searchTerm, setSearchTerm, kpiFilter, setKpiFilter } = filtros;
  const [activeTab, setActiveTab] = useState<string>('unassigned');
  const [initialTabSet, setInitialTabSet] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [modo, setModo] = useModoDoPainel(role);

  // A lista não tem os cartões de números; um filtro de cartão ligado no
  // painel sumiria da vista e esconderia chamados sem explicação.
  const escolherModo = useCallback((novo: ModoDoPainel) => {
    if (novo === 'lista') setKpiFilter(null);
    setModo(novo);
  }, [setModo, setKpiFilter]);

  // Definir a aba inicial: se o técnico tem chamados próprios em atendimento, inicia em "Meus Chamados";
  // se não tem nenhum atribuído a si e há chamados na Fila de Espera, inicia em "Fila de Espera" ou "Todos os Chamados".
  React.useEffect(() => {
    if (initialTabSet) return;
    if (myTicketsLoading || unassignedLoading || allTicketsLoading) return;

    if (myTickets.length > 0) {
      setActiveTab('my-tickets');
    } else if (unassigned.length > 0) {
      setActiveTab('unassigned');
    } else if (allActiveTickets.length > 0) {
      setActiveTab('all-tickets');
    } else {
      setActiveTab('unassigned');
    }
    setInitialTabSet(true);
  }, [myTicketsLoading, unassignedLoading, allTicketsLoading, myTickets.length, unassigned.length, allActiveTickets.length, initialTabSet]);

  useRealtimeTickets();

  const handleAssumeTicket = useCallback(async (ticketId: string) => {
    const technicianName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Técnico';
    const technicianId = user?.id;

    if (!technicianId) {
      toast({
        title: 'Erro de Autenticação',
        description: 'Usuário não autenticado para assumir o chamado.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await assumeTicket.mutateAsync({
        id: ticketId,
        userName: technicianName
      });
    } catch {
      // Error handled by mutation onError
    }
  }, [profile, user, assumeTicket, toast]);

  const selecionarIndicador = useCallback((indicador: Indicador) => {
    if (indicador === 'resolved') {
      setClosedOpen(true);
      setKpiFilter(null);
      setActiveTab('my-tickets');
      setTimeout(() => document.getElementById('closed-tickets-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
      return;
    }
    setKpiFilter(f => f === indicador ? null : indicador);
    setActiveTab('my-tickets');
    document.getElementById('tickets-section')?.scrollIntoView({ behavior: 'smooth' });
  }, [setKpiFilter]);

  if (statsLoading) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">Sincronizando Dashboard...</span>
    </div>
  );

  const totalDaAba = activeTab === 'unassigned'
    ? filtros.filteredUnassignedTickets.length
    : activeTab === 'my-tickets' ? filtros.filteredMyTickets.length : filtros.filteredAllTickets.length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-end -mt-4">
        <SeletorDeModo modo={modo} onEscolher={escolherModo} />
      </div>

      {/* Alerta de ausência de agentes */}
      {activeAgentsCount === 0 && unassigned.length > 0 && (
        <div className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 flex items-start gap-3 text-destructive animate-in fade-in zoom-in duration-300">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <h4 className="font-semibold text-sm">Atenção: Auto-atribuição Indisponível</h4>
            <p className="text-xs text-destructive/90 leading-relaxed">
              Existem {unassigned.length} ticket(s) na Fila de Espera, mas o sistema de auto-atribuição não encontrou agentes técnicos ou admins online/ativos para esta empresa. O roteamento automático foi pausado.
            </p>
          </div>
        </div>
      )}

      {modo === 'lista' ? (
        initialTabSet ? (
          <ModoLista
            filtros={filtros}
            recorteInicial={RECORTE_DA_ABA[activeTab] ?? 'fila'}
            onAssume={handleAssumeTicket}
          />
        ) : (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" /></div>
        )
      ) : (
        <div className="space-y-8">
          <Indicadores stats={stats} kpiFilter={kpiFilter} closedOpen={closedOpen} onSelecionar={selecionarIndicador} />

          {(role === 'admin' || role === 'developer') && teamWorkload && teamWorkload.length > 0 && (
            <CargaDaEquipe teamWorkload={teamWorkload} />
          )}

          <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
            <div className="2xl:col-span-8 space-y-4 min-w-0">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                  <Input
                    autoComplete="off"
                    placeholder="Buscar #número, título ou cliente"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-28 h-9 rounded-xl"
                  />
                  {searchTerm && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {totalDaAba} {totalDaAba === 1 ? 'resultado' : 'resultados'}
                    </span>
                  )}
                </div>

                <Button
                  variant={advancedFiltersOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                  className="h-9 rounded-xl gap-1.5 text-xs font-semibold self-end md:self-auto"
                >
                  <Filter className="w-3.5 h-3.5" /> Filtros
                </Button>
              </div>

              {advancedFiltersOpen && <FiltrosAvancados filtros={filtros} />}

              <div id="tickets-section" className="scroll-mt-6" />
              <AbasDeChamados
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                filtros={filtros}
                totalNaFila={unassigned.length}
                onAssume={handleAssumeTicket}
              />
            </div>

            <LateralDoTecnico workload={workload} recentClosed={recentClosed} />
          </div>
        </div>
      )}
    </div>
  );
};
