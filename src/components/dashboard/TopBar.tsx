import React from 'react';
import { Plus, Settings, Shield, Search, User, LogOut, LayoutDashboard, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';
import { NotificationsPopover } from './NotificationsPopover';
import { ThemeToggle } from '@/components/ThemeToggle';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { data: profile } = useUserProfile();
  const { data: role } = useUserRole();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Logout realizado com sucesso' });
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex items-center justify-between mb-8 pb-4">
      {/* Área de Busca */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar tickets..." 
            className="pl-10 bg-background border border-border rounded-lg"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Separador vertical */}
        <Separator orientation="vertical" className="h-8 mx-2" />
        
        {/* Botão Destaque: Novo Ticket */}
        <Button 
          onClick={() => navigate('/novo-ticket')}
          className="rounded-full px-5 gap-2 shadow-md hover:shadow-lg transition-all bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Novo Ticket
        </Button>
        
        {/* Separador */}
        <Separator orientation="vertical" className="h-8 mx-2" />
        
        {/* Links de Navegação - Apenas Ícones com Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/')}
              className={`transition-colors ${
                isActive('/') 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Dashboard</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/ajustes')}
              className={`transition-colors ${
                isActive('/ajustes') 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ajustes</TooltipContent>
        </Tooltip>

        {(role === 'admin' || role === 'developer') && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/relatorios')}
                  className={`transition-colors ${
                    isActive('/relatorios') 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <PieChart className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Relatórios</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/admin')}
                  className={`transition-colors ${
                    isActive('/admin') 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Admin</TooltipContent>
            </Tooltip>
          </>
        )}
        
        {/* Separador */}
        <Separator orientation="vertical" className="h-8 mx-2" />
        
        {/* Ações do Usuário */}
        <NotificationsPopover />
        
        <ThemeToggle />
        
        <Button 
          variant="ghost"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted"
        >
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{profile?.full_name || 'Usuário'}</span>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sair</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
