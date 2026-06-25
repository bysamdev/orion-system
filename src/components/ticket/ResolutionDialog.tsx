import React, { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

interface ResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (notes: string, sendSurvey: boolean) => void;
  isPending?: boolean;
}

export const ResolutionDialog: React.FC<ResolutionDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}) => {
  const [notes, setNotes] = useState('');
  const [sendSurvey, setSendSurvey] = useState(true);

  const handleConfirm = () => {
    if (!notes.trim()) return;
    onConfirm(notes.trim(), sendSurvey);
    setNotes('');
    setSendSurvey(true);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Resolver Chamado
          </AlertDialogTitle>
          <AlertDialogDescription>
            Descreva a resolução do problema antes de marcar como resolvido. O chamado será marcado como resolvido e o solicitante será notificado.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="resolution-notes" className="text-sm font-medium">
              Notas de Resolução <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="resolution-notes"
              placeholder="Descreva o que foi feito para resolver o problema..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              maxLength={5000}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">{notes.length}/5000 caracteres</p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="send-survey"
              checked={sendSurvey}
              onCheckedChange={(checked) => setSendSurvey(checked === true)}
            />
            <Label htmlFor="send-survey" className="text-sm cursor-pointer">
              Enviar pesquisa de satisfação ao cliente
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={!notes.trim() || isPending}
            className="gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
