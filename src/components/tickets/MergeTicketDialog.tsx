import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Merge, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { mensagemDeErroDeMesclagem } from '@/lib/errosDeMesclagem';

/**
 * Antes daqui se digitava "#1024, #1025" num campo de texto. O campo aceitava
 * qualquer número, inclusive de chamados de outro solicitante — e o banco
 * recusava depois, com ORI12, já com o diálogo fechado em cima do usuário.
 * Pior: número de chamado é fácil de errar por um dígito, e o erro só
 * aparecia no fim.
 *
 * O seletor mostra exatamente o conjunto que fn_merge_tickets aceita: mesmo
 * solicitante, mesma empresa, chamado ainda aberto. O que não está na lista
 * não é mesclável, e a lista vazia diz por quê.
 *
 * A tela continua sendo só conveniência: a regra mora no banco, porque a RPC
 * é chamável direto do browser.
 */

/** Status que não entram na lista de duplicados. */
const STATUS_ENCERRADOS = ['resolved', 'closed', 'cancelled'];

interface ChamadoCandidato {
  id: string;
  ticket_number: number;
  title: string;
  status: string;
  created_at: string;
}

interface MergeTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryTicketId: string;
  primaryUserId: string;
  companyId: string;
  onMergeComplete: () => void;
}

export const MergeTicketDialog: React.FC<MergeTicketDialogProps> = ({
  open,
  onOpenChange,
  primaryTicketId,
  primaryUserId,
  companyId,
  onMergeComplete,
}) => {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  // Fechar o diálogo descarta a seleção: reabrir e encontrar caixas já
  // marcadas de uma tentativa anterior é como se mescla sem querer.
  useEffect(() => {
    if (!open) setSelecionados([]);
  }, [open]);

  const { data: candidatos, isLoading, error: erroDaBusca } = useQuery({
    queryKey: ['chamadosMesclaveis', primaryTicketId, primaryUserId, companyId],
    enabled: open && Boolean(primaryUserId && companyId),
    // Sem cache: entre uma mesclagem e outra a lista muda, e oferecer um
    // chamado já mesclado gera um ORI11 que o usuário não tem como explicar.
    staleTime: 0,
    queryFn: async (): Promise<ChamadoCandidato[]> => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, title, status, created_at')
        .eq('user_id', primaryUserId)
        .eq('company_id', companyId)
        .neq('id', primaryTicketId)
        .not('status', 'in', `(${STATUS_ENCERRADOS.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
  });

  const alternar = (id: string) => {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((outro) => outro !== id) : [...atual, id]
    );
  };

  const handleMerge = async () => {
    if (selecionados.length === 0) return;

    setIsPending(true);
    try {
      const { error } = await supabase.rpc('fn_merge_tickets', {
        primary_id: primaryTicketId,
        duplicate_ids: selecionados,
      });

      if (error) throw error;

      toast({
        title: 'Chamados mesclados',
        description:
          selecionados.length === 1
            ? '1 chamado foi unificado neste e encerrado.'
            : `${selecionados.length} chamados foram unificados neste e encerrados.`,
      });

      onMergeComplete();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Erro ao mesclar',
        description: mensagemDeErroDeMesclagem(err),
        variant: 'destructive',
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[520px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-primary" />
            Mesclar Chamados
          </AlertDialogTitle>
          <AlertDialogDescription>
            Os chamados marcados serão unificados neste e encerrados. O histórico
            e os anexos deles passam para cá.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          {isLoading && (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando chamados do mesmo solicitante...
            </div>
          )}

          {!isLoading && erroDaBusca && (
            <p className="py-6 text-center text-sm text-destructive">
              Não foi possível carregar os chamados. Tente novamente.
            </p>
          )}

          {!isLoading && !erroDaBusca && candidatos?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum outro chamado aberto deste solicitante nesta empresa.
              <br />
              <span className="text-xs">
                Só é possível mesclar chamados da mesma pessoa e da mesma empresa.
              </span>
            </p>
          )}

          {!isLoading && !erroDaBusca && candidatos && candidatos.length > 0 && (
            <ScrollArea className="max-h-[280px] pr-3">
              <ul className="space-y-1">
                {candidatos.map((chamado) => {
                  const marcado = selecionados.includes(chamado.id);
                  return (
                    <li key={chamado.id}>
                      <label
                        className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                      >
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => alternar(chamado.id)}
                          disabled={isPending}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              #{chamado.ticket_number}
                            </span>
                            <StatusBadge status={chamado.status} />
                          </span>
                          <span className="block text-sm font-medium mt-1 break-words">
                            {chamado.title}
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            Aberto em {formatDate(chamado.created_at)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            onClick={handleMerge}
            disabled={selecionados.length === 0 || isPending}
            className="gap-2 font-bold"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
            {isPending
              ? 'Mesclando...'
              : selecionados.length === 0
                ? 'Selecione os duplicados'
                : `Mesclar ${selecionados.length} chamado${selecionados.length > 1 ? 's' : ''}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
