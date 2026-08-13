import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Sparkles, Activity, Search, ListTodo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TicketSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: {
    coreProblem: string;
    diagnosis: string;
    nextSteps: string;
  } | null;
}

export const TicketSummaryDialog: React.FC<TicketSummaryDialogProps> = ({
  open,
  onOpenChange,
  summary,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background border-border shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Resumo com IA
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-200">
                  Copilot
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Análise estruturada do chamado gerada pela IA.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {summary ? (
          <div className="grid gap-6 py-4">
            <Card className="p-4 border-l-4 border-l-red-500 bg-red-500/5 shadow-none border-t-0 border-r-0 border-b-0 rounded-r-xl">
              <div className="flex items-center gap-2 mb-2 text-red-600 font-bold">
                <Search className="w-4 h-4" />
                <h4>Problema Central</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {summary.coreProblem}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-500/5 shadow-none border-t-0 border-r-0 border-b-0 rounded-r-xl">
              <div className="flex items-center gap-2 mb-2 text-amber-600 font-bold">
                <Activity className="w-4 h-4" />
                <h4>Diagnóstico</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {summary.diagnosis}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-green-500 bg-green-500/5 shadow-none border-t-0 border-r-0 border-b-0 rounded-r-xl">
              <div className="flex items-center gap-2 mb-2 text-green-600 font-bold">
                <ListTodo className="w-4 h-4" />
                <h4>Próximos Passos</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {summary.nextSteps}
              </p>
            </Card>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Sparkles className="w-12 h-12 text-muted-foreground/30 animate-pulse mb-4" />
            <p className="text-muted-foreground">Gerando análise detalhada...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
