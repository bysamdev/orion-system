import { useToast } from '@/hooks/use-toast';
import { mapDatabaseError, logError } from './error-handling';

/**
 * Custom hook para tratamento consistente de erros em toda a aplicação
 * Garante que erros técnicos não sejam expostos ao usuário final
 */
export function useErrorHandler() {
  const { toast } = useToast();

  /**
   * Trata erro e exibe mensagem amigável ao usuário
   * @param error - Erro capturado
   * @param context - Contexto onde o erro ocorreu (para logging)
   * @param customTitle - Título personalizado (opcional)
   */
  const handleError = (
    error: unknown,
    context: string,
    customTitle?: string
  ): void => {
    // Log do erro (detalhes técnicos apenas em dev)
    logError(context, error);

    // Mapeia erro para mensagem amigável
    const userMessage = mapDatabaseError(error);

    // Exibe toast com mensagem amigável
    toast({
      title: customTitle || 'Erro',
      description: userMessage,
      variant: 'destructive',
    });
  };

  /**
   * Trata erro de validação Zod e exibe primeira mensagem
   * @param validationError - Erro do Zod safeParse
   * @param context - Contexto da validação
   */
  const handleValidationError = (
    validationError: { success: false; error: { errors: Array<{ message: string }> } },
    context: string
  ): void => {
    const message = validationError.error.errors[0]?.message || 'Erro de validação';
    
    logError(context, validationError.error);
    
    toast({
      title: 'Erro de validação',
      description: message,
      variant: 'destructive',
    });
  };

  return {
    handleError,
    handleValidationError,
  };
}
