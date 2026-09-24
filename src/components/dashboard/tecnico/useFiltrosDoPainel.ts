import { useMemo, useState } from 'react';
import { Ticket } from '@/hooks/useTickets';
import { criarFiltro } from './filtroDoPainel';

// Estado dos filtros do painel do técnico e as três listas já filtradas
// (fila de espera, meus chamados e todos os chamados).
//
// Uma regra só vale para todas as listas: o que o técnico escolhe no filtro
// some ou aparece igual na Lista, em todas as colunas do Quadro e nos
// fechados. Prazo e categoria usam o mesmo cálculo que os cartões mostram
// (urgenciaDe, identidade.ts), não o sla_status gravado, que o cron só
// atualiza a cada 15 minutos.
export function useFiltrosDoPainel(
  unassigned: Ticket[],
  myTickets: Ticket[],
  allActiveTickets: Ticket[],
  closedTickets: Ticket[] = [],
) {
  const [searchTerm, setSearchTerm] = useState('');
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all');

  const passa = useMemo(() => criarFiltro({
    busca: searchTerm, indicador: kpiFilter, prioridade: priorityFilter, categoria: categoryFilter,
    status: statusFilter, tecnico: technicianFilter, empresa: companyFilter, prazo: slaFilter,
  }), [searchTerm, kpiFilter, priorityFilter, categoryFilter, statusFilter, technicianFilter, companyFilter, slaFilter]);

  const filteredUnassignedTickets = useMemo(() => unassigned.filter(passa), [unassigned, passa]);
  const filteredMyTickets = useMemo(() => myTickets.filter(passa), [myTickets, passa]);
  const filteredAllTickets = useMemo(() => allActiveTickets.filter(passa), [allActiveTickets, passa]);
  const filteredClosedTickets = useMemo(() => closedTickets.filter(passa), [closedTickets, passa]);

  const limparFiltros = () => {
    setPriorityFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setTechnicianFilter('all');
    setCompanyFilter('all');
    setSlaFilter('all');
  };

  const temFiltro = priorityFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
    || technicianFilter !== 'all' || companyFilter !== 'all' || slaFilter !== 'all';
  const temFiltroNaFila = !!searchTerm || !!kpiFilter || temFiltro;

  return {
    searchTerm, setSearchTerm,
    kpiFilter, setKpiFilter,
    priorityFilter, setPriorityFilter,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    technicianFilter, setTechnicianFilter,
    companyFilter, setCompanyFilter,
    slaFilter, setSlaFilter,
    limparFiltros,
    temFiltro,
    temFiltroNaFila,
    filteredUnassignedTickets,
    filteredMyTickets,
    filteredAllTickets,
    filteredClosedTickets,
  };
}

export type FiltrosDoPainel = ReturnType<typeof useFiltrosDoPainel>;
