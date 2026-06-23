import React from 'react';
import { Plus, Search, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Ticket } from '@/hooks/useTickets';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<Pick<Ticket, 'id' | 'ticket_number' | 'title' | 'status'>[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  
  // Nome aleatório estável para enganar o autofill sem quebrar a seleção nativa do input (Ctrl+A)
  const randomName = React.useMemo(() => `gst-${Math.random().toString(36).slice(2)}`, []);

  React.useEffect(() => {
    const handleClearSearch = () => {
      setSearchQuery('');
    };
    window.addEventListener('clear-global-search', handleClearSearch);
    return () => window.removeEventListener('clear-global-search', handleClearSearch);
  }, []);

  React.useEffect(() => {
    const searchTickets = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
      setIsSearching(true);
      setShowResults(true);
      try {
        const cleanQuery = searchQuery.replace(/#/g, '').trim();
        const numberMatch = cleanQuery.match(/^\d+$/);
        let query = supabase.from('tickets').select('id, ticket_number, title, status');
        if (numberMatch) {
          query = query.eq('ticket_number', parseInt(numberMatch[0], 10));
        } else {
          query = query.ilike('title', `%${cleanQuery}%`);
        }
        const { data, error } = await query.limit(6);
        if (error) throw error;
        setSearchResults((data as unknown as Pick<Ticket, 'id' | 'ticket_number' | 'title' | 'status'>[]) || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchTickets, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="flex items-center gap-4">
      {/* Busca global */}
      <div className="relative flex-1 max-w-2xl group">
        {isSearching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        )}
        
        {/* Isca invisível para gerenciadores de senha agressivos */}
        <input 
          type="text" 
          style={{ display: 'none' }} 
          autoComplete="username" 
          tabIndex={-1} 
          aria-hidden="true" 
        />

        <input
          id="global-search-ticket"
          name={randomName}
          type="text"
          role="searchbox"
          autoComplete="off"
          // "new-password" é o único valor que todos os browsers respeitam para desativar autocomplete
          // Usamos data-lpignore para desativar LastPass/1Password também
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          placeholder="Buscar tickets por #número, título ou cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full h-10 rounded-xl border border-border/40 bg-muted/20 pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background focus:border-primary/30 transition-all"
        />

        {/* Dropdown de resultados */}
        {showResults && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 bg-card/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 overflow-y-auto max-h-[360px]">
              <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                {isSearching ? 'Buscando...' : searchResults.length > 0 ? 'Resultados' : 'Nenhum ticket encontrado'}
              </p>
              {searchResults.map((ticket) => (
                <button
                  key={ticket.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigate(`/ticket/${ticket.id}`);
                    setShowResults(false);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-primary/10 transition-colors text-left group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-primary">#{ticket.ticket_number}</span>
                      <StatusBadge status={ticket.status} className="text-[9px] py-0 h-4" />
                    </div>
                    <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors mt-0.5">
                      {ticket.title}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Ações globais */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => navigate('/novo-ticket')}
              className="rounded-xl px-4 h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-primary/25 transition-all transform hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-widest hidden sm:inline">Novo Ticket</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-bold">Criar novo chamado</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
