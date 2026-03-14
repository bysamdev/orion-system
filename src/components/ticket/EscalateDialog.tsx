import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowUpRight, Loader2 } from 'lucide-react';

interface EscalateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (technicianName: string, newPriority: string, reason: string) => Promise<void>;
  isPending: boolean;
  technicians: { id: string; full_name: string | null }[];
  currentPriority: string;
  currentAssignee: string | null;
}

export const EscalateDialog: React.FC<EscalateDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  technicians,
  currentPriority,
  currentAssignee,
}) => {
  const [selectedTechnician, setSelectedTechnician] = useState<string>(currentAssignee || '');
  const [selectedPriority, setSelectedPriority] = useState<string>(currentPriority);
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    await onConfirm(selectedTechnician, selectedPriority, reason);
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border/50 bg-background/95 backdrop-blur shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-amber-500" />
            </div>
            <DialogTitle className="text-xl font-bold">Escalar Chamado</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Transfira a responsabilidade para outro técnico ou eleve a prioridade deste atendimento se necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <label className="text-xs font-bold text-foreground uppercase tracking-widest">
              Designar para
            </label>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                <SelectValue placeholder="Selecione um técnico..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned" className="text-muted-foreground italic">Fila Geral (Nenhum)</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.full_name || ''}>
                    {tech.full_name || 'Sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-foreground uppercase tracking-widest">
              Nova Prioridade
            </label>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent" className="text-red-500 font-bold">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
              Motivo da Escalação <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Explique detalhadamente o motivo do redirecionamento ou aumento de prioridade..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none min-h-[120px] bg-muted/20 border-border/50 text-sm"
              required
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <p className="font-bold mb-1">Atenção</p>
              <p className="leading-relaxed opacity-90">
                Ao confirmar, o novo responsável será notificado e o motivo da escalação será registrado no histórico do chamado para auditoria.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="font-bold uppercase tracking-wider text-xs h-11"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || !reason.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider text-xs h-11 px-8 shadow-lg shadow-amber-500/20"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
            Confirmar Escalação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
