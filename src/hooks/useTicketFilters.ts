import { useState, useMemo } from 'react';
import { Ticket } from './useTickets';
import { TicketFiltersState } from '@/components/dashboard/TicketFilters';

const DEFAULT_FILTERS: TicketFiltersState = {
  search: '',
  priority: 'all',
  category: 'all',
  sortBy: 'created_at',
  sortOrder: 'desc'
};

export const useTicketFilters = (tickets: Ticket[] = []) => {
  const [filters, setFilters] = useState<TicketFiltersState>(DEFAULT_FILTERS);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(ticket => 
        ticket.title.toLowerCase().includes(searchLower) ||
        ticket.description.toLowerCase().includes(searchLower) ||
        ticket.ticket_number.toString().includes(searchLower) ||
        ticket.requester_name.toLowerCase().includes(searchLower)
      );
    }

    // Priority filter
    if (filters.priority !== 'all') {
      result = result.filter(ticket => ticket.priority === filters.priority);
    }

    // Category filter
    if (filters.category !== 'all') {
      result = result.filter(ticket => ticket.category === filters.category);
    }

    // Sort
    result.sort((a, b) => {
      let aValue: any = a[filters.sortBy as keyof Ticket];
      let bValue: any = b[filters.sortBy as keyof Ticket];

      // Handle priority sorting with custom order
      if (filters.sortBy === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        aValue = priorityOrder[aValue as keyof typeof priorityOrder] || 0;
        bValue = priorityOrder[bValue as keyof typeof priorityOrder] || 0;
      }

      // Handle date sorting
      if (filters.sortBy === 'created_at' || filters.sortBy === 'updated_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return result;
  }, [tickets, filters]);

  const updateFilters = (newFilters: Partial<TicketFiltersState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return {
    filters,
    filteredTickets,
    updateFilters,
    resetFilters,
    activeFiltersCount: [
      filters.search,
      filters.priority !== 'all',
      filters.category !== 'all'
    ].filter(Boolean).length
  };
};
