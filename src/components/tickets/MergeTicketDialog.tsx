import React, { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Merge } from 'lucide-react';
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
  const [duplicateIds, setDuplicateIds] = useState<string>('');
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const handleMerge = async () => {
    if (!duplicateIds.trim()) {
      toast({
        title: "Erro",
        description: "Informe pelo menos um ID de ticket para mesclar.",
        variant: "destructive"
      });
      return;
    }

    const ids = duplicateIds.split(',').map(id => id.trim()).filter(Boolean);
    
    setIsPending(true);
    try {
      const { error } = await supabase.rpc('fn_merge_tickets', {
        primary_id: primaryTicketId,
        duplicate_ids: ids
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Tickets mesclados com sucesso.",
      });
      
      onMergeComplete();
      onOpenChange(false);
      setDuplicateIds('');
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
      <AlertDialogContent className="sm:max-w-[400px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-primary" />
            Mesclar Ticket
          </AlertDialogTitle>
          <AlertDialogDescription>
            Informe os IDs dos tickets duplicados (separados por vírgula). Eles serão encerrados e mesclados a este ticket.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="duplicate-ids" className="text-sm font-medium">
              IDs dos Tickets Duplicados
            </Label>
            <Input
              id="duplicate-ids"
              placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
              value={duplicateIds}
              onChange={e => setDuplicateIds(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            onClick={handleMerge}
            disabled={!duplicateIds.trim() || isPending}
            className="gap-2"
          >
            <Merge className="w-4 h-4" />
            Mesclar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
