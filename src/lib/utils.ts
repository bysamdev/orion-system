import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date: any, fmt: string = 'dd/MM/yyyy', options?: any) => 
  date ? format(new Date(date), fmt, options) : '—';
