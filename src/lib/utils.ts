import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date: any, fmt: string = 'dd/MM/yyyy', options?: any) => 
  date ? format(new Date(date), fmt, options) : '—';

/**
 * Formata minutos em formato humano progressivo: minutos -> horas -> dias -> meses
 * Ex: 15min | 2h 30min | 3 dias e 4h | 1 mês e 5 dias | 2 meses
 */
export function formatDurationHuman(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return 'Menos de 1min';

  const minutesInHour = 60;
  const minutesInDay = 24 * 60; // 1440
  const minutesInMonth = 30 * 24 * 60; // 43200

  const months = Math.floor(totalMinutes / minutesInMonth);
  const remainingAfterMonths = totalMinutes % minutesInMonth;

  const days = Math.floor(remainingAfterMonths / minutesInDay);
  const remainingAfterDays = remainingAfterMonths % minutesInDay;

  const hours = Math.floor(remainingAfterDays / minutesInHour);
  const minutes = remainingAfterDays % minutesInHour;

  // >= 1 mês (30+ dias)
  if (months > 0) {
    if (days > 0) {
      return `${months} ${months === 1 ? 'mês' : 'meses'} e ${days} ${days === 1 ? 'dia' : 'dias'}`;
    }
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  // >= 1 dia (24+ horas)
  if (days > 0) {
    if (hours > 0) {
      return `${days} ${days === 1 ? 'dia' : 'dias'} e ${hours}h`;
    }
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  }

  // >= 1 hora (60+ minutos)
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${hours}h`;
  }

  // < 1 hora
  return `${minutes}min`;
}
