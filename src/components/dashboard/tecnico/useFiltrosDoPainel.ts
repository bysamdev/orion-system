import { useMemo, useState } from 'react';
import { Ticket } from '@/hooks/useTickets';

// Estado dos filtros do painel do técnico e as três listas já filtradas
// (fila de espera, meus chamados e todos os chamados).
export function useFiltrosDoPainel(unassigned: Ticket[], myTickets: Ticket[], allActiveTickets: Ticket[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<string>('all');

  const filteredUnassignedTickets = useMemo(() => {
    let result = [...unassigned];
    if (kpiFilter === 'sla') result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');

    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (companyFilter !== 'all') result = result.filter(t => t.company_name?.toLowerCase().includes(companyFilter.toLowerCase()));
    if (slaFilter !== 'all') result = result.filter(t => t.sla_status === slaFilter);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower) ||
        t.company_name?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [unassigned, searchTerm, kpiFilter, priorityFilter, categoryFilter, companyFilter, slaFilter]);

  const filteredMyTickets = useMemo(() => {
    let result = [...myTickets];
    if (kpiFilter === 'in-progress') result = result.filter(t => t.status === 'in-progress');
    else if (kpiFilter === 'sla') result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');
    else if (kpiFilter === 'pending') result = result.filter(t => ['open', 'reopened', 'awaiting-customer'].includes(t.status));

    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (technicianFilter !== 'all') result = result.filter(t => t.assigned_to === technicianFilter);
    if (companyFilter !== 'all') result = result.filter(t => t.company_name?.toLowerCase().includes(companyFilter.toLowerCase()));
    if (slaFilter !== 'all') result = result.filter(t => t.sla_status === slaFilter);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower) ||
        t.company_name?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [myTickets, searchTerm, kpiFilter, priorityFilter, categoryFilter, statusFilter, technicianFilter, companyFilter, slaFilter]);

  const filteredAllTickets = useMemo(() => {
    let result = [...allActiveTickets];
    if (kpiFilter === 'in-progress') result = result.filter(t => t.status === 'in-progress');
    else if (kpiFilter === 'sla') result = result.filter(t => t.sla_status === 'attention' || t.sla_status === 'breached');
    else if (kpiFilter === 'pending') result = result.filter(t => ['open', 'reopened', 'awaiting-customer'].includes(t.status));

    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (technicianFilter !== 'all') result = result.filter(t => t.assigned_to === technicianFilter);
    if (companyFilter !== 'all') result = result.filter(t => t.company_name?.toLowerCase().includes(companyFilter.toLowerCase()));
    if (slaFilter !== 'all') result = result.filter(t => t.sla_status === slaFilter);

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.ticket_number.toString().includes(lower) ||
        t.requester_name.toLowerCase().includes(lower) ||
        t.company_name?.toLowerCase().includes(lower) ||
        t.assigned_to?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [allActiveTickets, searchTerm, kpiFilter, priorityFilter, categoryFilter, statusFilter, technicianFilter, companyFilter, slaFilter]);

  const limparFiltros = () => {
    setPriorityFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setCompanyFilter('all');
    setSlaFilter('all');
  };

  const temFiltroNaFila = !!searchTerm || priorityFilter !== 'all' || categoryFilter !== 'all' || companyFilter !== 'all' || slaFilter !== 'all';

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
    temFiltroNaFila,
    filteredUnassignedTickets,
    filteredMyTickets,
    filteredAllTickets,
  };
}

export type FiltrosDoPainel = ReturnType<typeof useFiltrosDoPainel>;
