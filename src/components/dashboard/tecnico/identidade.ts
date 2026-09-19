import { CATEGORIAS } from '@/lib/categoriasDeChamado';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Ticket } from '@/hooks/useTickets';
import { calculateSlaStatus } from '@/lib/ticket-helpers';

// Peças que dão identidade visual a um chamado no painel do técnico: ícone da
// categoria, cor da prioridade, prazo escrito por extenso e iniciais.

export { CATEGORIAS };

export const categoriaDe = (c: string | null | undefined) => CATEGORIAS[c ?? ''] ?? CATEGORIAS.outros;

// Faixa lateral do cartão: a cor diz a prioridade antes de qualquer leitura.
export const FAIXA_DA_PRIORIDADE: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
};

export type Urgencia = 'atrasado' | 'atencao' | 'em_dia' | 'pausado';

const PAUSADOS = ['awaiting-customer', 'awaiting-third-party'];

export function urgenciaDe(t: Ticket): Urgencia {
  if (PAUSADOS.includes(t.status)) return 'pausado';
  const sla = calculateSlaStatus(t.sla_due_date, t.created_at);
  if (sla === 'breached') return 'atrasado';
  if (sla === 'attention' || sla === 'warning') return 'atencao';
  return 'em_dia';
}

export interface Prazo {
  texto: string;
  tom: 'perigo' | 'alerta' | 'neutro' | 'pausa';
}

// "venceu há 3 dias", "vence em 2 horas", "SLA pausado", "sem prazo".
export function prazoDe(t: Ticket): Prazo {
  const urgencia = urgenciaDe(t);
  if (urgencia === 'pausado') return { texto: 'SLA pausado', tom: 'pausa' };
  if (!t.sla_due_date) return { texto: 'Sem prazo', tom: 'neutro' };
  const vence = new Date(t.sla_due_date);
  const distancia = formatDistanceToNowStrict(vence, { locale: ptBR });
  if (urgencia === 'atrasado') return { texto: `Venceu há ${distancia}`, tom: 'perigo' };
  if (urgencia === 'atencao') return { texto: `Vence em ${distancia}`, tom: 'alerta' };
  return { texto: `Vence em ${distancia}`, tom: 'neutro' };
}

export const COR_DO_PRAZO: Record<Prazo['tom'], string> = {
  perigo: 'text-red-600 dark:text-red-400',
  alerta: 'text-orange-600 dark:text-orange-400',
  neutro: 'text-muted-foreground',
  pausa: 'text-violet-600 dark:text-violet-400',
};

export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// A mesma pessoa sempre com a mesma cor, para reconhecer de relance.
const CORES_DE_AVATAR = [
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
];

export function corDoAvatar(nome: string | null | undefined): string {
  let h = 0;
  for (const c of nome ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_DE_AVATAR[h % CORES_DE_AVATAR.length];
}

export const semResponsavel = (t: Ticket) => !t.assigned_to_user_id && !t.assigned_to;
