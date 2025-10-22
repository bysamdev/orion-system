/**
 * Error handling utilities for mapping database errors to user-friendly messages
 * Prevents exposure of technical implementation details to users
 */

interface DatabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Maps Supabase/PostgreSQL error codes to user-friendly messages in Portuguese
 */
export function mapDatabaseError(error: unknown): string {
  if (!error) return 'Ocorreu um erro desconhecido';

  const dbError = error as DatabaseError;
  
  // Check for common PostgreSQL error codes
  if (dbError.code) {
    switch (dbError.code) {
      case '23505': // unique_violation
        return 'Este registro já existe no sistema';
      
      case '23503': // foreign_key_violation
        return 'Não é possível realizar esta operação pois existem registros relacionados';
      
      case '23502': // not_null_violation
        return 'Alguns campos obrigatórios não foram preenchidos';
      
      case '23514': // check_constraint_violation
        return 'Valor inválido fornecido. Verifique os dados e tente novamente';
      
      case '42501': // insufficient_privilege
        return 'Você não tem permissão para realizar esta operação';
      
      case 'PGRST116': // Row Level Security violation
        return 'Acesso negado. Você não tem permissão para acessar este recurso';
      
      case '22P02': // invalid_text_representation
        return 'Formato de dados inválido';
      
      case '08006': // connection_failure
      case '08003': // connection_does_not_exist
        return 'Erro de conexão com o servidor. Tente novamente';
      
      default:
        // Log the error code for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
          console.error('Unmapped database error code:', dbError.code, dbError);
        }
    }
  }

  // Check for specific error message patterns (case-insensitive)
  const message = dbError.message?.toLowerCase() || '';
  
  if (message.includes('permission denied') || message.includes('rls')) {
    return 'Você não tem permissão para realizar esta operação';
  }
  
  if (message.includes('duplicate key')) {
    return 'Este registro já existe no sistema';
  }
  
  if (message.includes('violates foreign key')) {
    return 'Não é possível realizar esta operação pois existem registros relacionados';
  }
  
  if (message.includes('violates check constraint')) {
    return 'Valor inválido fornecido. Verifique os dados e tente novamente';
  }

  if (message.includes('company assignment')) {
    return 'Apenas administradores master podem alterar a empresa de um usuário';
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return 'A operação demorou muito tempo. Tente novamente';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente';
  }

  // Default safe error message
  return 'Não foi possível concluir a operação. Tente novamente';
}

/**
 * Safely logs errors with appropriate detail level based on environment
 */
export function logError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  } else {
    // In production, log minimal information
    console.error(`[${context}] Error occurred`);
  }
}
