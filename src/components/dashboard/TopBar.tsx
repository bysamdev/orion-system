import React from 'react';
import { 
  Plus, Settings, Shield, Search, User, LogOut, 
  LayoutDashboard, PieChart, Monitor, ArrowRight, BookOpen, FileText, Loader2
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
        const numberMatch = searchQuery.match(/^\d+$/); // Exact number match for ticket_number
        
        let query = supabase
          .from('tickets')
          .select('id, ticket_number, title, status');
          
        if (numberMatch) {
          const num = parseInt(numberMatch[0], 10);
          // If it's an exact number, prioritize searching by ticket_number
          query = query.eq('ticket_number', num);
        } else {
          // Otherwise, search by title
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
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/40">
      {/* Área de Busca */}
      <div className="flex items-center gap-4 flex-1 max-w-md relative">
        <div className="relative flex-1">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <input 
            placeholder="Buscar por #número ou título..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            className="w-full flex h-11 rounded-xl border border-border/40 bg-muted/20 px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {showResults && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowResults(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {isSearching ? 'Buscando...' : searchResults.length > 0 ? 'Resultados da busca' : 'Nenhum ticket encontrado'}
              </div>
              <div className="space-y-1">
                {searchResults.map((ticket) => (
                  <button
                    key={ticket.id}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur before navigation
                      navigate(`/ticket/${ticket.id}`);
                      setShowResults(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono font-bold text-primary">#{ticket.ticket_number}</p>
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{ticket.title}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 justify-end lg:flex-initial lg:overflow-visible">
        <div className="flex items-center gap-1 px-2">
          <NavItem 
            icon={LayoutDashboard} 
            label="Home" 
            tooltip="Dashboard" 
            isActive={isActive('/')} 
            onClick={() => navigate('/')} 
          />
          
          {(role === 'admin' || role === 'developer') && (
            <NavItem 
              icon={PieChart} 
              label="Relatórios" 
              tooltip="Analytics e Stats" 
              isActive={isActive('/relatorios')} 
              onClick={() => navigate('/relatorios')} 
            />
          )}

          {(role === 'admin' || role === 'developer') && (
            <NavItem 
              icon={Shield} 
              label="Admin" 
              tooltip="Configurações do Sistema" 
              isActive={isActive('/admin')} 
              onClick={() => navigate('/admin')} 
            />
          )}

          {(role === 'admin' || role === 'developer' || role === 'technician') && (
            <NavItem 
              icon={Monitor} 
              label="Máquinas" 
              tooltip="Monitoramento em Tempo Real" 
              isActive={isActive('/monitoring')} 
              onClick={() => navigate('/monitoring')} 
            />
          )}

          <NavItem 
            icon={Settings} 
            label="Conta" 
            tooltip="Perfil e Preferências" 
            isActive={isActive('/ajustes')} 
            onClick={() => navigate('/ajustes')} 
          />

          <Separator orientation="vertical" className="h-8 mx-1 hidden md:block" />

          <NavItem 
            icon={BookOpen} 
            label="KB" 
            tooltip="Base de Conhecimento" 
            isActive={isActive('/knowledge')} 
            onClick={() => navigate('/knowledge')} 
          />

          <NavItem 
            icon={FileText} 
            label="Guia" 
            tooltip="Documentação Orion Agent" 
            isActive={isActive('/documentacao')} 
            onClick={() => navigate('/documentacao')} 
          />
        </div>
        
        <Separator orientation="vertical" className="h-8 mx-1 shrink-0" />
        
        <Button 
          onClick={() => navigate('/novo-ticket')}
          className="rounded-full px-4 h-9 gap-2 shadow-md hover:shadow-lg transition-all bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden xl:inline">Novo Ticket</span>
        </Button>
        
        <Separator orientation="vertical" className="h-8 mx-1 shrink-0" />
        
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div><NotificationsPopover /></div>
            </TooltipTrigger>
            <TooltipContent>Notificações</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div><ThemeToggle /></div>
            </TooltipTrigger>
            <TooltipContent>Alternar Tema</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sair da Conta</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: any;
  label: string;
  tooltip: string;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, tooltip, isActive, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button 
        variant="ghost" 
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-1 h-14 min-w-[72px] px-3 rounded-xl transition-all duration-300",
          isActive 
            ? "text-primary bg-primary/10 shadow-inner" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Icon className={cn("w-5 h-5 transition-transform duration-300", isActive && "scale-110")} />
        <span className="text-[10px] font-black uppercase tracking-tight opacity-80 whitespace-nowrap">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-[10px] font-bold uppercase tracking-widest">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);
