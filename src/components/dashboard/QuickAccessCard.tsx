import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle, Plus } from 'lucide-react';

export const QuickAccessCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden border-none shadow-2xl relative group transform transition-all duration-300 hover:scale-[1.01]">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background glass-card" />
      <CardContent className="p-6 sm:p-8 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="flex-shrink-0 p-4 bg-primary/20 rounded-2xl border border-primary/20 shadow-lg group-hover:rotate-12 transition-transform duration-500">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          
          <div className="flex-1 space-y-1">
            <h2 className="text-2xl font-black text-foreground tracking-tight">
              Precisa de ajuda com algo?
            </h2>
            <p className="text-muted-foreground font-medium">
              Abra um novo chamado e nossa equipe técnica atenderá você prontamente.
            </p>
          </div>
          
          <Button 
            size="lg"
            onClick={() => navigate('/novo-ticket')}
            className="w-full sm:w-auto gap-2 text-base font-black uppercase tracking-widest shadow-[0_0_20px_hsla(var(--primary),0.3)] hover:shadow-primary/40 transition-all rounded-xl transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Abrir Novo Chamado
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
