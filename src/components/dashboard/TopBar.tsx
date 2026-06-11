import React from 'react';
import { 
  Plus, Settings, Shield, Search, User, LogOut, 
  Home, PieChart, Monitor, ArrowRight, BookOpen, FileText, Loader2, BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';
import { NotificationsPopover } from './NotificationsPopover';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { data: profile } = useUserProfile();
  const { data: role } = useUserRole();

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

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-border gap-4">
      {/* Área de Busca Progressiva */}
      <div className="flex items-center gap-4 flex-1 max-w-md relative group">
        <div className="relative flex-1">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          )}
          <input 
            placeholder="Search #number or title..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            className="w-full flex h-10 rounded-sm border border-border bg-card px-10 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary transition-all focus:bg-background"
          />
        </div>

        {showResults && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowResults(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-2xl rounded-sm p-2 z-50 overflow-hidden overflow-y-auto max-h-[400px]">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">
                {isSearching ? 'SEARCHING...' : searchResults.length > 0 ? 'RESULTS' : 'NO TICKETS FOUND'}
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
                    className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors text-left group border border-transparent hover:border-border rounded-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                         <p className="text-[10px] font-mono font-bold text-primary">#{ticket.ticket_number}</p>
                         <span className={cn(
                           "text-[9px] px-1.5 py-0.5 border font-mono font-bold uppercase",
                           ticket.status === 'aberto' ? "border-green-500/30 text-green-500 bg-green-500/10" : "border-border text-muted-foreground bg-muted"
                         )}>
                           {ticket.status}
                         </span>
                      </div>
                      <p className="text-sm text-foreground truncate mt-1">{ticket.title}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 justify-end lg:flex-initial lg:overflow-visible">
        <div className="flex items-center gap-0.5 px-2">
          <NavItem 
            icon={Home} 
            label="Início" 
            isActive={isActive('/')} 
            onClick={() => navigate('/')} 
          />
          
          {(role === 'admin' || role === 'developer') && (
            <NavItem 
              icon={BarChart2 || PieChart} 
              label="Insights" 
              isActive={isActive('/relatorios')} 
              onClick={() => navigate('/relatorios')} 
            />
          )}

          {(role === 'admin' || role === 'developer') && (
            <NavItem 
              icon={Shield} 
              label="Admin" 
              isActive={isActive('/admin')} 
              onClick={() => navigate('/admin')} 
            />
          )}

          {(role === 'admin' || role === 'developer' || role === 'technician') && (
            <NavItem 
              icon={Monitor} 
              label="Sistemas" 
              isActive={isActive('/monitoring')} 
              onClick={() => navigate('/monitoring')} 
            />
          )}

          {(role === 'admin' || role === 'developer' || role === 'technician') && (
            <NavItem 
              icon={Monitor} 
              label="Alertas" 
              isActive={isActive('/alertas')} 
              onClick={() => navigate('/alertas')} 
            />
          )}

          {(role === 'admin' || role === 'developer') && (
            <NavItem 
              icon={Settings} 
              label="Automação" 
              isActive={isActive('/automacoes')} 
              onClick={() => navigate('/automacoes')} 
            />
          )}

          <NavItem 
            icon={Settings} 
            label="Perfil" 
            isActive={isActive('/ajustes')} 
            onClick={() => navigate('/ajustes')} 
          />

          <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />

          <NavItem 
            icon={BookOpen} 
            label="Wiki" 
            isActive={isActive('/knowledge')} 
            onClick={() => navigate('/knowledge')} 
          />

          {(role === 'admin' || role === 'developer' || role === 'technician') && (
            <NavItem 
              icon={Shield} 
              label="Docs" 
              isActive={isActive('/documentacao')} 
              onClick={() => navigate('/documentacao')} 
            />
          )}

          <NavItem 
            icon={FileText} 
            label="Manual" 
            isActive={isActive('/tutorial')} 
            onClick={() => navigate('/tutorial')} 
          />
        </div>
        
        <Separator orientation="vertical" className="h-6 mx-2 shrink-0" />
        
        <Button 
          onClick={() => navigate('/novo-ticket')}
          className="rounded-sm px-4 h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 font-mono text-[11px] uppercase tracking-wider"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Novo Ticket</span>
        </Button>
        
        <Separator orientation="vertical" className="h-6 mx-2 shrink-0" />
        
        <div className="flex items-center gap-1 shrink-0">
          <NotificationsPopover />
          <ThemeToggle />
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm transition-colors h-9 w-9"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: any;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center gap-1 h-12 min-w-[64px] px-2 rounded-sm transition-colors border border-transparent",
      isActive 
        ? "text-primary bg-primary/5 border-primary/20" 
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    )}
  >
    <Icon className="w-4 h-4" />
    <span className="text-[9px] font-mono uppercase tracking-tight opacity-80">{label}</span>
  </button>
);
