import type { Ticket } from '@/hooks/useTickets';
import { urgenciaDe } from './identidade';

export interface CriteriosDoPainel {
  busca: string;
  indicador: string | null;
  prioridade: string;
  categoria: string;
  status: string;
  tecnico: string;
  empresa: string;
  prazo: string;
}

// Regra única de filtro do painel do técnico. 'all' desliga o critério.
// Prazo usa a mesma urgência calculada que os cartões mostram.
export function criarFiltro(c: CriteriosDoPainel): (t: Ticket) => boolean {
  const busca = c.busca.toLowerCase().replace(/^#/, '');
  const empresa = c.empresa.toLowerCase();
  return (t) => {
    if (c.indicador === 'in-progress' && t.status !== 'in-progress') return false;
    if (c.indicador === 'sla' && !['atrasado', 'atencao'].includes(urgenciaDe(t))) return false;
    if (c.indicador === 'pending' && !['open', 'reopened', 'awaiting-customer'].includes(t.status)) return false;

    if (c.prioridade !== 'all' && t.priority !== c.prioridade) return false;
    if (c.categoria !== 'all' && t.category !== c.categoria) return false;
    if (c.status !== 'all' && t.status !== c.status) return false;
    if (c.tecnico !== 'all' && t.assigned_to !== c.tecnico) return false;
    if (c.prazo !== 'all' && urgenciaDe(t) !== c.prazo) return false;
    if (c.empresa !== 'all' && !t.company_name?.toLowerCase().includes(empresa)) return false;

    if (!busca) return true;
    return (
      t.title.toLowerCase().includes(busca) ||
      t.ticket_number.toString().includes(busca) ||
      t.requester_name.toLowerCase().includes(busca) ||
      !!t.company_name?.toLowerCase().includes(busca) ||
      !!t.assigned_to?.toLowerCase().includes(busca)
    );
  };
}
