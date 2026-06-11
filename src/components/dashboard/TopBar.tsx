import React from 'react';
import { 
  Plus, Search, LogOut, Loader2, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NotificationsPopover } from './NotificationsPopover';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);

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
        const numberMatch = searchQuery.match(/^\d+$/);
        
        let query = supabase
          .from('tickets')
          .select('id, ticket_number, title, status');
          
        if (numberMatch) {
          const num = parseInt(numberMatch[0], 10);
          query = query.eq('ticket_number', num);
        } else {
          query = query.ilike('title', `%${cleanQuery}%`);
        }

        const { data, error } = await query.limit(5);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchTickets, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Logout realizado com sucesso' });
    navigate('/auth');
  };

  return (
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/40 gap-4">
      {/* Área de Busca Progressiva */}
      <div className="flex items-center gap-4 flex-1 max-w-xl relative group">
        <div className="relative flex-1">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          )}
          <input 
            placeholder="Buscar por #número ou título..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            className="w-full flex h-10 rounded-xl border border-border/40 bg-muted/20 px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all focus:bg-background focus:border-primary/30"
          />
        </div>

        {showResults && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowResults(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-card/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden overflow-y-auto max-h-[400px]">
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {isSearching ? 'Buscando...' : searchResults.length > 0 ? 'Resultados da busca' : 'Nenhum ticket encontrado'}
              </div>
              <div className="space-y-1">
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
                         <p className="text-[10px] font-mono font-bold text-primary">#{ticket.ticket_number}</p>
                         <span className={cn(
                           "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                           ticket.status === 'aberto' ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                         )}>
                           {ticket.status}
                         </span>
                      </div>
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors mt-0.5">{ticket.title}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Ações Globais */}
      <div className="flex items-center justify-end shrink-0 gap-1 lg:gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={() => navigate('/novo-ticket')}
              className="rounded-xl px-4 h-10 gap-2 shadow-lg hover:shadow-primary/20 transition-all bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transform hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-widest hidden sm:inline">Novo Ticket</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-bold">Criar novo chamado</TooltipContent>
        </Tooltip>
        
        <Separator orientation="vertical" className="h-8 mx-1 shrink-0 opacity-40" />
        
        <div className="flex items-center gap-1 shrink-0">
          <NotificationsPopover />
          <ThemeToggle />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors h-10 w-10 ml-1"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sair do Sistema</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
