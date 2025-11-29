import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle, Plus } from 'lucide-react';

export const QuickAccessCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-lg">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="flex-shrink-0 p-3 bg-primary/10 rounded-full">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          
          <div className="flex-1 space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              Precisa de ajuda com algo?
            </h2>
            <p className="text-muted-foreground">
              Abra um novo chamado e nossa equipe técnica atenderá você prontamente.
            </p>
          </div>
          
          <Button 
            size="lg"
            onClick={() => navigate('/new-ticket')}
            className="w-full sm:w-auto gap-2 text-base font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Abrir Novo Chamado
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
