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
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/40 gap-4">
      {/* Área de Busca Progressiva */}
      <div className="flex items-center gap-4 flex-1 max-w-md relative group">
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
      
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 justify-end lg:flex-initial lg:overflow-visible">
        <div className="flex items-center gap-1 px-2">
          <NavItem 
            icon={Home} 
            label="Início" 
            tooltip="Painel Principal" 
            isActive={isActive('/')} 
            onClick={() => navigate('/')} 
          />
          
          {(role === 'admin' || role === 'developer') && (
            <NavItem 
              icon={BarChart2 || PieChart} 
              label="Insights" 
              tooltip="Relatórios e Analytics" 
              isActive={isActive('/relatorios')} 
              onClick={() => navigate('/relatorios')} 
            />
          )}

          {(role === 'admin' || role === 'developer') && (
            <NavItem 
              icon={Shield} 
              label="Painel Admin" 
              tooltip="Faturamento & Empresas" 
              isActive={isActive('/admin')} 
              onClick={() => navigate('/admin')} 
            />
          )}

          {(role === 'admin' || role === 'developer' || role === 'technician') && (
            <NavItem 
              icon={Monitor} 
              label="Sistemas" 
              tooltip="Monitoramento Agente" 
              isActive={isActive('/monitoring')} 
              onClick={() => navigate('/monitoring')} 
            />
          )}

          <NavItem 
            icon={Settings} 
            label="Perfil" 
            tooltip="Minha Conta" 
            isActive={isActive('/ajustes')} 
            onClick={() => navigate('/ajustes')} 
          />

          <Separator orientation="vertical" className="h-8 mx-1 hidden md:block opacity-40" />

          <NavItem 
            icon={BookOpen} 
            label="Wiki" 
            tooltip="Base de Conhecimento" 
            isActive={isActive('/knowledge')} 
            onClick={() => navigate('/knowledge')} 
          />

          {(role === 'admin' || role === 'developer' || role === 'technician') && (
            <NavItem 
              icon={Shield} 
              label="Docs" 
              tooltip="Manuais do Agente" 
              isActive={isActive('/documentacao')} 
              onClick={() => navigate('/documentacao')} 
            />
          )}

          <NavItem 
            icon={FileText} 
            label="Manual" 
            tooltip="Guia de Uso do Sistema" 
            isActive={isActive('/tutorial')} 
            onClick={() => navigate('/tutorial')} 
          />
        </div>
        
        <Separator orientation="vertical" className="h-8 mx-1 shrink-0 opacity-40" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={() => navigate('/novo-ticket')}
              className="rounded-xl px-4 h-10 gap-2 shadow-lg hover:shadow-primary/20 transition-all bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transform hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-widest hidden xl:inline">Novo Ticket</span>
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
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors h-10 w-10"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sair</TooltipContent>
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
      <button 
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-1 h-14 min-w-[64px] px-2 rounded-xl transition-all duration-300 relative group",
          isActive 
            ? "text-primary bg-primary/5" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <Icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", isActive && "scale-110")} />
        <span className="text-[9px] font-black uppercase tracking-tight opacity-70 whitespace-nowrap group-hover:opacity-100 transition-opacity">{label}</span>
        
        {isActive && (
          <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full shadow-[0_0_8px_hsla(var(--primary),0.6)] animate-in fade-in zoom-in duration-500" />
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-[10px] font-bold uppercase tracking-widest bg-sidebar-background text-white border-none shadow-2xl">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);
