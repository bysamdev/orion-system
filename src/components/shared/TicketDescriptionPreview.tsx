import React from 'react';
import { cn } from '@/lib/utils';
import { resumoDaDescricao } from '@/lib/resumoDaDescricao';

interface TicketDescriptionPreviewProps {
  description: string | null | undefined;
  className?: string;
}

/**
 * Prévia da descrição sob o título, nas listas de chamados (item 1 do lote de
 * 2026-09-12).
 *
 * Um componente só, usado nos quatro lugares que renderizam lista — histórico
 * mobile, histórico desktop, dashboard do técnico e portal do cliente — para
 * a hierarquia visual não divergir entre eles com o tempo.
 *
 * Não renderiza NADA quando não há descrição: um <p> vazio deixaria um buraco
 * de altura de linha no card, e a lista fica com cards de alturas diferentes
 * sem motivo aparente.
 *
 * `line-clamp-2` é o corte visual; resumoDaDescricao é o corte de conteúdo.
 * Os dois juntos porque o clamp sozinho ainda carregaria o texto inteiro no
 * DOM, e o resumo sozinho não garante duas linhas em telas estreitas.
 */
export const TicketDescriptionPreview: React.FC<TicketDescriptionPreviewProps> = ({
  description,
  className,
}) => {
  const resumo = resumoDaDescricao(description);

  if (!resumo) return null;

  return (
    <p className={cn('text-xs text-muted-foreground line-clamp-2 leading-snug', className)}>
      {resumo}
    </p>
  );
};
