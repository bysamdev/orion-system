import React, { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Merge, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MergeTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryTicketId: string;
  companyId: string;
  onMergeComplete: () => void;
}

export const MergeTicketDialog: React.FC<MergeTicketDialogProps> = ({
  open,
  onOpenChange,
  primaryTicketId,
  companyId,
  onMergeComplete
}) => {
  const [duplicateInput, setDuplicateInput] = useState<string>('');
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const handleMerge = async () => {
    if (!duplicateInput.trim()) {
      toast({
        title: "Erro",
        description: "Informe pelo menos um número ou ID de chamado para mesclar.",
        variant: "destructive"
      });
      return;
    }

    const rawTokens = duplicateInput.split(',').map(id => id.trim().replace(/^#/, '')).filter(Boolean);
    if (rawTokens.length === 0) return;

    setIsPending(true);
    try {
      // Separa UUIDs de Números sequenciais
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const targetUuids: string[] = [];
      const ticketNumbers: number[] = [];

      for (const token of rawTokens) {
        if (uuidRegex.test(token)) {
          targetUuids.push(token);
        } else if (/^\d+$/.test(token)) {
          ticketNumbers.push(parseInt(token, 10));
        } else {
          throw new Error(`Identificador inválido: "${token}". Use números (#1024) ou UUIDs.`);
        }
      }

      // Se houver números sequenciais, busca os respectivos UUIDs no banco
      if (ticketNumbers.length > 0) {
        const { data: tickets, error: fetchErr } = await supabase
          .from('tickets')
          .select('id, ticket_number')
          .in('ticket_number', ticketNumbers);

        if (fetchErr) throw fetchErr;

        if (!tickets || tickets.length !== ticketNumbers.length) {
          const foundNumbers = (tickets || []).map(t => t.ticket_number);
          const missing = ticketNumbers.filter(n => !foundNumbers.includes(n));
          throw new Error(`Chamado(s) não encontrado(s): #${missing.join(', #')}`);
        }

        tickets.forEach(t => targetUuids.push(t.id));
      }

      // Garante IDs únicos e que o ticket primário não seja mesclado em si mesmo
      const finalIds = Array.from(new Set(targetUuids)).filter(id => id !== primaryTicketId);

      if (finalIds.length === 0) {
        throw new Error("Nenhum ticket duplicado válido para mesclagem.");
      }

      const { error } = await (supabase.rpc as any)('fn_merge_tickets', {
        primary_id: primaryTicketId,
        duplicate_ids: finalIds
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${finalIds.length} chamado(s) mesclado(s) com sucesso.`,
      });
      
      onMergeComplete();
      onOpenChange(false);
      setDuplicateInput('');
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao mesclar",
        description: err.message || "Não foi possível mesclar os tickets.",
        variant: "destructive"
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-primary" />
            Mesclar Chamados
          </AlertDialogTitle>
          <AlertDialogDescription>
            Informe os números dos chamados (ex: <code>#1024, #1025</code>) que serão unificados e encerrados neste chamado principal.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="duplicate-numbers" className="text-sm font-medium">
              Números dos Chamados Duplicados
            </Label>
            <Input
              id="duplicate-numbers"
              placeholder="Ex: #1024, #1025 ou 1024"
              value={duplicateInput}
              onChange={e => setDuplicateInput(e.target.value)}
              className="mt-1.5 font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Separe múltiplos números por vírgula.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            onClick={handleMerge}
            disabled={!duplicateInput.trim() || isPending}
            className="gap-2 font-bold"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
            {isPending ? "Mesclando..." : "Confirmar Mesclagem"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
