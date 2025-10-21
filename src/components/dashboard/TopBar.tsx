import React from 'react';
import { Home, Plus, Settings, Shield, Bell, Search, User, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';

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

  return (
    <div className="flex items-center justify-between mb-8 pb-4">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar tickets..." 
            className="pl-10 bg-background border border-border rounded-lg"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/novo-ticket')}
          className="text-primary hover:text-primary hover:bg-primary/10 font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Ticket
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/')}
          className="text-primary hover:text-primary hover:bg-primary/10 font-medium"
        >
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/ajustes')}
          className="text-primary hover:text-primary hover:bg-primary/10 font-medium"
        >
          <Settings className="w-4 h-4 mr-2" />
          Ajustes
        </Button>

        {role === 'admin' && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/admin')}
            className="text-primary hover:text-primary hover:bg-primary/10 font-medium"
          >
            <Shield className="w-4 h-4 mr-2" />
            Admin
          </Button>
        )}
        
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
        </Button>
        
        <Button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <User className="w-4 h-4" />
          <span className="text-sm font-medium">{profile?.full_name || 'Usuário'}</span>
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSignOut}
          title="Sair"
          className="hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5 text-destructive" />
        </Button>
      </div>
    </div>
  );
};
