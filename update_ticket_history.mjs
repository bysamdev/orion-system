import fs from 'fs';

const path = '/Users/sam/Documents/orion-system/src/pages/TicketHistory.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import React, { useState, useMemo, useCallback } from 'react';",
  "import React, { useState, useMemo, useCallback, useEffect } from 'react';"
);
content = content.replace(
  "import { Search, History, Filter, X, ArrowRight, Loader2 } from 'lucide-react';",
  "import { Search, History, Filter, X, ArrowRight, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';"
);

// 2. State & Queries
const oldFetchTarget = `  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: role, isLoading: roleLoading } = useUserRole(); // Added isLoading for role
  const { data: profile } = useUserProfile();

  // Fetch historic tickets
  const { data: historicTickets = [], isLoading } = useQuery<Ticket[]>({ // Explicitly type historicTickets
    queryKey: ['historic-tickets', profile?.company_id, role],
    queryFn: async () => {
      let query = supabaseRead
        .from('tickets')
        .select('*')
        .in('status', ['resolved', 'closed', 'cancelled'])
        .order('updated_at', { ascending: false })
        .limit(200);

      // Se for cliente, filtrar apenas pela empresa dele
      if (role === 'customer' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      interface ProfileItem {
        id: string;
        company_id: string;
      }
      interface CompanyItem {
        id: string;
        name: string;
      }

      const userIds = [...new Set(data.map(t => t.user_id))];
      const { data: profilesData } = await supabaseRead
        .from('profiles')
        .select('id, company_id')
        .in('id', userIds);
      
      const profiles = (profilesData || []) as ProfileItem[];

      const companyIds = [...new Set(profiles.map(p => p.company_id))];
      const { data: companiesData } = await supabaseRead
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      
      const companies = (companiesData || []) as CompanyItem[];

      const profileMap = new Map<string, ProfileItem>(profiles.map(p => [p.id, p]));
      const companyMap = new Map<string, CompanyItem>(companies.map(c => [c.id, c]));

      return data.map((ticket: any) => { // Cast ticket to any for initial map, then return as Ticket
        const profile = profileMap.get(ticket.user_id);
        const company = profile ? companyMap.get(profile.company_id) : null;
        return { ...ticket, company_name: company?.name || null } as Ticket;
      });
    }
  });

  const filteredTickets = useMemo(() => {
    let result = [...historicTickets];

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.ticket_number.toString().includes(q) || 
        t.requester_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [historicTickets, searchTerm, statusFilter, priorityFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };`;

const newFetchTarget = `  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile } = useUserProfile();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(0);
  };

  const handlePriorityFilterChange = (val: string) => {
    setPriorityFilter(val);
    setPage(0);
  };

  // Fetch historic tickets
  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['historic-tickets', profile?.company_id, role, page, statusFilter, priorityFilter, debouncedSearch],
    queryFn: async () => {
      let query = supabaseRead
        .from('tickets')
        .select('*', { count: 'exact' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      } else {
        query = query.in('status', ['resolved', 'closed', 'cancelled']);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      if (debouncedSearch) {
        const isNumeric = !isNaN(Number(debouncedSearch)) && debouncedSearch.trim() !== '';
        if (isNumeric) {
          query = query.or(\`title.ilike.%\${debouncedSearch}%,ticket_number.eq.\${Number(debouncedSearch)},requester_name.ilike.%\${debouncedSearch}%\`);
        } else {
          query = query.or(\`title.ilike.%\${debouncedSearch}%,requester_name.ilike.%\${debouncedSearch}%\`);
        }
      }

      if (role === 'customer' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      query = query
        .order('updated_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;

      if (error) throw error;
      
      interface ProfileItem {
        id: string;
        company_id: string;
      }
      interface CompanyItem {
        id: string;
        name: string;
      }

      const userIds = [...new Set((data || []).map(t => t.user_id))];
      const { data: profilesData } = userIds.length > 0
        ? await supabaseRead.from('profiles').select('id, company_id').in('id', userIds)
        : { data: [] };
      
      const profiles = (profilesData || []) as ProfileItem[];

      const companyIds = [...new Set(profiles.map(p => p.company_id))];
      const { data: companiesData } = companyIds.length > 0
        ? await supabaseRead.from('companies').select('id, name').in('id', companyIds)
        : { data: [] };
      
      const companies = (companiesData || []) as CompanyItem[];

      const profileMap = new Map<string, ProfileItem>(profiles.map(p => [p.id, p]));
      const companyMap = new Map<string, CompanyItem>(companies.map(c => [c.id, c]));

      const enrichedTickets = (data || []).map((ticket: any) => {
        const profile = profileMap.get(ticket.user_id);
        const company = profile ? companyMap.get(profile.company_id) : null;
        return { ...ticket, company_name: company?.name || null } as Ticket;
      });

      return { tickets: enrichedTickets, count: count || 0 };
    }
  });

  const filteredTickets = queryResult?.tickets || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setPage(0);
  };`;

content = content.replace(oldFetchTarget, newFetchTarget);

// Replace setStatusFilter
content = content.replace(/onValueChange={setStatusFilter}/g, "onValueChange={handleStatusFilterChange}");
content = content.replace(/onValueChange={setPriorityFilter}/g, "onValueChange={handlePriorityFilterChange}");

// Add pagination
const oldPaginationTarget = `            {!isLoading && filteredTickets.length > 0 && (
              <div className="p-4 border-t border-border/40 bg-muted/10 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                Mostrando {filteredTickets.length}{' '}
                {filteredTickets.length === 1 ? 'resultado limitado' : 'resultados limitados'}
              </div>
            )}`;

const newPaginationTarget = `            {!isLoading && filteredTickets.length > 0 && (
              <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between text-sm">
                <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
                  Mostrando {filteredTickets.length} de {totalCount} resultado{totalCount !== 1 ? 's' : ''}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-bold text-muted-foreground px-2">
                      Página {page + 1} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}`;

content = content.replace(oldPaginationTarget, newPaginationTarget);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
