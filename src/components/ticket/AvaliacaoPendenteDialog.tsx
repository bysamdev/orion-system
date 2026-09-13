import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, Loader2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { useAddTicketRating } from '@/hooks/useTicketRating';
import type { ChamadoPendenteDeAvaliacao } from '@/hooks/useAvaliacaoPendente';

interface AvaliacaoPendenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chamado: ChamadoPendenteDeAvaliacao;
  /** Chamado depois que a pendência é resolvida — avaliada ou pulada. */
  onResolvido: () => void;
}

/**
 * Avaliação pendente, resolvida no lugar.
 *
 * O formulário é inline e não navega para /avaliacao/:id: o usuário chegou
 * aqui tentando abrir um chamado, e mandá-lo para outra rota faria perder o
 * que ele já tinha escrito.
 */
export const AvaliacaoPendenteDialog: React.FC<AvaliacaoPendenteDialogProps> = ({
  open,
  onOpenChange,
  chamado,
  onResolvido,
}) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const addRating = useAddTicketRating();

  const enviar = async () => {
    if (rating === 0) return;
    await addRating.mutateAsync({ ticketId: chamado.id, rating, comment });
    onResolvido();
  };

  const pular = async () => {
    await addRating.mutateAsync({ ticketId: chamado.id, skipped: true });
    onResolvido();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Como foi o atendimento anterior?</DialogTitle>
          <DialogDescription>
            Antes de abrir um novo chamado, conte rapidamente como foi o último. Leva alguns segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5">
          <p className="text-sm font-bold text-foreground">
            <span className="font-mono text-xs text-muted-foreground">#{chamado.ticket_number}</span>{' '}
            {chamado.title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Encerrado em {formatDate(chamado.encerradoEm, "dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex justify-center gap-2 py-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              type="button"
              aria-label={`${s} de 5 estrelas`}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(s)}
              className="p-1 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Star
                className={cn(
                  'w-9 h-9 transition-colors',
                  (hovered || rating) >= s ? 'fill-primary text-primary' : 'text-muted-foreground/30'
                )}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <Textarea
            placeholder="Quer comentar alguma coisa? (opcional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="min-h-[80px] text-sm resize-none"
          />
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-1">
          <Button variant="ghost" onClick={pular} disabled={addRating.isPending} className="text-muted-foreground">
            Pular avaliação
          </Button>
          <Button onClick={enviar} disabled={rating === 0 || addRating.isPending} className="gap-2 font-bold">
            {addRating.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar e continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
