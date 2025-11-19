import { z } from 'zod';

/**
 * Validation schemas for ticket operations
 * These schemas enforce input validation before database operations
 */

export const ticketStatusSchema = z.enum(['open', 'in-progress', 'resolved', 'closed', 'reopened'], {
  errorMap: () => ({ message: 'Status deve ser: aberto, em andamento, resolvido, fechado ou reaberto' })
});

export const ticketPrioritySchema = z.enum(['urgent', 'high', 'medium', 'low'], {
  errorMap: () => ({ message: 'Prioridade deve ser: urgente, alta, média ou baixa' })
});

export const ticketUpdateTypeSchema = z.enum(['comment', 'status_change', 'assignment', 'priority_change'], {
  errorMap: () => ({ message: 'Tipo de atualização inválido' })
});

// Regex seguro que bloqueia caracteres de controle, Unicode invisível e potencialmente perigosos
const safeTextRegex = /^[a-zA-Z0-9\s\-_.áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ!?,;:()\[\]{}@#$%&*+='"\/\\]+$/;

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
    .max(5000, 'Conteúdo deve ter no máximo 5000 caracteres')
    .regex(safeTextRegex, 'O conteúdo contém caracteres inválidos'),
  type: ticketUpdateTypeSchema
});

export const ticketCreationSchema = z.object({
  title: z.string()
    .trim()
    .min(5, 'Título deve ter no mínimo 5 caracteres')
    .max(200, 'Título deve ter no máximo 200 caracteres')
    .regex(safeTextRegex, 'O título contém caracteres inválidos'),
  description: z.string()
    .trim()
    .min(20, 'Descrição deve ter no mínimo 20 caracteres')
    .max(5000, 'Descrição deve ter no máximo 5000 caracteres')
    .regex(safeTextRegex, 'A descrição contém caracteres inválidos'),
  category: z.string()
    .trim()
    .min(1, 'Categoria é obrigatória')
    .regex(safeTextRegex, 'A categoria contém caracteres inválidos'),
  priority: ticketPrioritySchema,
  department: z.string()
    .trim()
    .max(50, 'Departamento deve ter no máximo 50 caracteres')
    .regex(safeTextRegex, 'O departamento contém caracteres inválidos')
    .optional()
});

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
