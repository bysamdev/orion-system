import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, HandHelping } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TicketDescriptionPreview } from '@/components/shared/TicketDescriptionPreview';
import { Ticket } from '@/hooks/useTickets';
import { SLABadge } from '../SLABadge';
import { TimeAgoBadge } from './TimeAgoBadge';

export const TicketRow: React.FC<{ ticket: Ticket }> = React.memo(({ ticket }) => {
  const navigate = useNavigate();
  return (
    <TableRow
      className="group relative cursor-pointer border-b border-border/40 hover:bg-muted/30 transition-all"
    >
      <TableCell className="py-3 font-mono text-xs text-muted-foreground">
        #{ticket.ticket_number}
      </TableCell>
      <TableCell className="py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
            {ticket.title}
          </p>
          <TicketDescriptionPreview description={ticket.description} className="max-w-[44ch]" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{ticket.requester_name}</span>
            <span>·</span>
            <span className="truncate max-w-[120px]">{ticket.company_name || 'N/A'}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <PriorityBadge priority={ticket.priority} size="sm" />
      </TableCell>
      <TableCell className="py-3 text-center">
        <StatusBadge status={ticket.status} />
      </TableCell>
      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
        <TimeAgoBadge date={ticket.created_at} curto />
      </TableCell>
      <TableCell className="py-3">
        <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} createdAt={ticket.created_at} variant="compact" />
      </TableCell>
      <TableCell className="py-3 text-right">
        <ArrowRight aria-label="Ver detalhes" className="inline-block w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/ticket/${ticket.id}`); }}
          className="absolute inset-0 z-10"
        />
      </TableCell>
    </TableRow>
  );
});
TicketRow.displayName = 'TicketRow';

export const UnassignedTicketRow: React.FC<{ ticket: Ticket; onAssume: (id: string) => void }> = React.memo(({ ticket: t, onAssume }) => {
  const navigate = useNavigate();
  return (
    <TableRow className="group relative border-b border-border/40 hover:bg-muted/30 transition-all cursor-pointer" onClick={() => navigate(`/ticket/${t.id}`)}>
      <TableCell className="py-3 font-mono text-xs text-muted-foreground">
        #{t.ticket_number}
      </TableCell>
      <TableCell className="py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
            {t.title}
          </p>
          <TicketDescriptionPreview description={t.description} className="max-w-[44ch]" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t.requester_name}</span>
            <span>·</span>
            <span className="truncate max-w-[120px]">{t.company_name || 'N/A'}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <PriorityBadge priority={t.priority} size="sm" />
      </TableCell>
      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
        <TimeAgoBadge date={t.created_at} curto />
      </TableCell>
      <TableCell className="py-3">
        <SLABadge slaStatus={t.sla_status} slaDueDate={t.sla_due_date} createdAt={t.created_at} variant="compact" />
      </TableCell>
      <TableCell className="py-3 text-right pr-6">
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); onAssume(t.id); }}
          className="h-7 px-3 rounded-lg text-xs font-semibold relative z-20 gap-1"
        >
          <HandHelping className="w-3.5 h-3.5" /> Assumir
        </Button>
      </TableCell>
    </TableRow>
  );
});
UnassignedTicketRow.displayName = 'UnassignedTicketRow';
