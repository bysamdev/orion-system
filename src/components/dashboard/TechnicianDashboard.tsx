import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTechnicianStats, useTeamWorkload } from '@/hooks/useTechnicianStats';
import { useMyActiveTickets, useUnassignedTicketsEnhanced, useAllActiveTickets, useMyRecentClosedTickets, useActiveAgentsCount } from '@/hooks/useMyTickets';
import { useUserRole, useUserProfile } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { useAssumeTicket } from '@/hooks/useTickets';
import { useFiltrosDoPainel } from './tecnico/useFiltrosDoPainel';
import { Indicadores } from './tecnico/Indicadores';
import { CargaDaEquipe } from './tecnico/CargaDaEquipe';
import { SeletorDeModo } from './tecnico/SeletorDeModo';
import { useModoDoPainel, ModoDoPainel } from './tecnico/useModoDoPainel';
import { ModoLista, Recorte } from './tecnico/ModoLista';
import { ModoQuadro } from './tecnico/ModoQuadro';

// recharts só entra quando alguém abre o modo Gráficos.
const ModoGraficos = lazy(() => import('./tecnico/ModoGraficos'));

const Carregando = () => (
  <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" /></div>
);

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: role } = useUserRole();
  const { data: profile } = useUserProfile();

  const { data: stats, isLoading: statsLoading } = useTechnicianStats(user?.id, role);
  const { data: myTickets = [], isLoading: myTicketsLoading } = useMyActiveTickets(user?.id);
  const { data: allActiveTickets = [], isLoading: allTicketsLoading } = useAllActiveTickets();
  const { data: unassigned = [], isLoading: unassignedLoading } = useUnassignedTicketsEnhanced();
  const { data: recentClosed = [] } = useMyRecentClosedTickets(user?.id);
  const { data: activeAgentsCount } = useActiveAgentsCount(profile?.company_id);
  const { data: teamWorkload } = useTeamWorkload(profile?.company_id);
  const assumeTicket = useAssumeTicket();

  const filtros = useFiltrosDoPainel(unassigned, myTickets, allActiveTickets);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modo, setModo] = useModoDoPainel(role);

  const carregandoListas = myTicketsLoading || unassignedLoading || allTicketsLoading;

  // A Lista abre onde há trabalho: nos meus chamados, senão na fila, senão em todos.
  const recorteInicial: Recorte = myTickets.length > 0 ? 'meus' : unassigned.length > 0 ? 'fila' : 'todos';

  const escolherModo = useCallback((novo: ModoDoPainel) => setModo(novo), [setModo]);


  const handleAssumeTicket = useCallback(async (ticketId: string) => {
    const technicianName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Técnico';

    if (!user?.id) {
      toast({
        title: 'Erro de Autenticação',
        description: 'Usuário não autenticado para assumir o chamado.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await assumeTicket.mutateAsync({ id: ticketId, userName: technicianName });
    } catch {
      // Error handled by mutation onError
    }
  }, [profile, user, assumeTicket, toast]);


  // Fila e ativos se sobrepõem; os gráficos contam cada chamado uma vez.
  const chamadosAtivos = useMemo(() => {
    const vistos = new Set<string>();
    return [...allActiveTickets, ...unassigned].filter(t => {
      if (vistos.has(t.id)) return false;
      vistos.add(t.id);
      return true;
    });
  }, [allActiveTickets, unassigned]);

  if (statsLoading) return <Carregando />;

  const ehGestor = role === 'admin' || role === 'developer';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-end -mt-4">
        <SeletorDeModo modo={modo} onEscolher={escolherModo} />
      </div>

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
        carregandoListas ? <Carregando /> : (
          <ModoLista filtros={filtros} recorteInicial={recorteInicial} onAssume={handleAssumeTicket} />
        )
      ) : modo === 'graficos' ? (
        <div className="space-y-6">
          <Indicadores stats={stats} />
          <Suspense fallback={<Carregando />}>
            <ModoGraficos chamados={chamadosAtivos} teamWorkload={teamWorkload} />
          </Suspense>
          {ehGestor && teamWorkload && teamWorkload.length > 0 && <CargaDaEquipe teamWorkload={teamWorkload} />}
        </div>
      ) : (
        <div className="space-y-6">
          <Indicadores stats={stats} />
          <ModoQuadro
            filtros={filtros}
            filtrosAbertos={filtrosAbertos}
            onAlternarFiltros={() => setFiltrosAbertos(v => !v)}
            recentClosed={recentClosed}
            onAssume={handleAssumeTicket}
          />
        </div>
      )}
    </div>
  );
};
