import { z } from 'zod';

/**
 * Validation schemas for ticket operations
 * These schemas enforce input validation before database operations
 */

export const ticketStatusSchema = z.enum(['open', 'in-progress', 'resolved', 'closed'], {
  errorMap: () => ({ message: 'Status deve ser: aberto, em andamento, resolvido ou fechado' })
});

export const ticketPrioritySchema = z.enum(['low', 'medium', 'high'], {
  errorMap: () => ({ message: 'Prioridade deve ser: baixa, média ou alta' })
});

export const ticketUpdateTypeSchema = z.enum(['created', 'status', 'assignment', 'comment'], {
  errorMap: () => ({ message: 'Tipo de atualização inválido' })
});

export const companyNameSchema = z.string()
  .trim()
  .min(1, 'Nome da empresa é obrigatório')
  .max(100, 'Nome da empresa deve ter no máximo 100 caracteres')
  .regex(/^[a-zA-Z0-9\s\-_.áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+$/, 
    'Nome da empresa contém caracteres inválidos');

export const userRoleSchema = z.enum(['customer', 'technician', 'admin', 'developer'], {
  errorMap: () => ({ message: 'Função de usuário inválida' })
});

export const profileUpdateSchema = z.object({
  full_name: z.string()
    .trim()
    .min(1, 'Nome completo é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  department: z.string()
    .trim()
    .max(50, 'Departamento deve ter no máximo 50 caracteres')
    .optional()
});

export const ticketUpdateSchema = z.object({
  ticket_id: z.string().uuid('ID do ticket inválido'),
  content: z.string()
    .trim()
    .min(1, 'Conteúdo é obrigatório')
    .max(5000, 'Conteúdo deve ter no máximo 5000 caracteres'),
  type: ticketUpdateTypeSchema
});

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
