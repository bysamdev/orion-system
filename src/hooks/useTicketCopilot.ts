import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TicketSummary {
  coreProblem: string;
  diagnosis: string;
  nextSteps: string;
}

export function useTicketCopilot() {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();

  const summarizeTicket = async (ticketId: string): Promise<TicketSummary | null> => {
    setIsSummarizing(true);
    try {
      // Mocking AI behavior
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        coreProblem: 'O usuário está relatando lentidão extrema no sistema durante o horário de pico, impedindo a geração de relatórios.',
        diagnosis: 'Os logs indicam alto consumo de CPU no servidor de banco de dados e consultas não otimizadas bloqueando outras transações.',
        nextSteps: '1. Otimizar as consultas lentas.\n2. Aumentar os recursos temporariamente.\n3. Informar o cliente sobre a manutenção.'
      };
    } catch (error) {
      toast({
        title: 'Erro no Copilot',
        description: 'Falha ao resumir o chamado.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSummarizing(false);
    }
  };

  const generateSuggestedResponse = async (ticketId: string): Promise<string | null> => {
    setIsSuggesting(true);
    try {
      // Mocking AI behavior
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return 'Olá! Entendi que você está enfrentando lentidão no sistema. Nossa equipe técnica já analisou os logs e identificou o gargalo no banco de dados. Estamos aplicando uma otimização nas consultas e aumentando os recursos temporariamente. Prevemos normalização em 30 minutos. Agradecemos a paciência!';
    } catch (error) {
      toast({
        title: 'Erro no Copilot',
        description: 'Falha ao gerar sugestão de resposta.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSuggesting(false);
    }
  };

  return {
    summarizeTicket,
    generateSuggestedResponse,
    isSummarizing,
    isSuggesting,
  };
}
