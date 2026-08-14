import React, { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Zap, Sparkles, MessageSquare } from 'lucide-react';
import { useCannedResponses } from '@/hooks/useCannedResponses';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (notes: string, sendSurvey: boolean) => void;
  isPending?: boolean;
}

const DEFAULT_RESOLVED_TEXT = 'Seu chamado foi resolvido! Qualquer dúvida, estamos à disposição.';

export const ResolutionDialog: React.FC<ResolutionDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}) => {
  const [notes, setNotes] = useState('');
  const [sendSurvey, setSendSurvey] = useState(true);
  const { data: cannedResponses = [] } = useCannedResponses();

  // Encontra a resposta pronta específica de chamado resolvido, se existir no banco
  const resolvedCanned = cannedResponses.find(
    r => r.title.toLowerCase().includes('resolvido') || r.shortcut?.includes('resolvido')
  );

  const resolvedTextToApply = resolvedCanned?.content || DEFAULT_RESOLVED_TEXT;

  const handleApplyQuickText = (text: string) => {
    setNotes(text);
  };

  const handleConfirm = () => {
    if (!notes.trim()) return;
    onConfirm(notes.trim(), sendSurvey);
    setNotes('');
    setSendSurvey(true);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[540px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Resolver Chamado
          </AlertDialogTitle>
          <AlertDialogDescription>
            Descreva a resolução do problema antes de marcar como resolvido. O chamado será marcado como resolvido e o solicitante será notificado.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Ações rápidas de texto de resolução */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="resolution-notes" className="text-sm font-medium">
                Notas de Resolução <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleApplyQuickText(resolvedTextToApply)}
                className="h-7 px-2.5 text-xs text-primary font-bold hover:bg-primary/10 rounded-lg gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Usar texto padrão
              </Button>
            </div>

            {/* Chips de preenchimento rápido */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleApplyQuickText(resolvedTextToApply)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
              >
                <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Chamado resolvido
              </button>

              <button
                type="button"
                onClick={() => handleApplyQuickText('O problema relatado foi investigado, corrigido e validado com sucesso.')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted/60 text-muted-foreground border border-border/50 hover:bg-muted transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                Problema solucionado
              </button>

              {cannedResponses.length > 0 && (
                <div className="inline-block ml-auto">
                  <Select
                    value=""
                    onValueChange={(val) => {
                      const found = cannedResponses.find(r => r.id === val);
                      if (found) handleApplyQuickText(found.content);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs border-border/50 bg-background/50 px-2 rounded-lg gap-1">
                      <SelectValue placeholder="Mais respostas prontas..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cannedResponses.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Textarea
              id="resolution-notes"
              placeholder="Descreva o que foi feito para resolver o problema..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              maxLength={5000}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">{notes.length}/5000 caracteres</p>
          </div>

          <div className="flex items-center space-x-2 pt-1">
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
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar Resolução
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
