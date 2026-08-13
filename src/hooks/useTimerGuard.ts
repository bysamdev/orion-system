import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { toast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const useTimerGuard = () => {
  const { user } = useAuth();
  const { data: activeTimer } = useActiveTimer(user?.id);
  const stopTimer = useStopTimer();

  // Inactivity auto-pause
  useEffect(() => {
    if (!activeTimer) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!activeTimer) return;
        stopTimer.mutate({ entryId: activeTimer.id });
        toast({
          title: 'Timer pausado',
          description: 'O timer foi pausado automaticamente após 30 minutos de inatividade.',
        });
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Attach listeners
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    // Initial call to start the timeout
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeTimer, stopTimer]);

  // beforeunload warning
  useEffect(() => {
    if (!activeTimer) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Most modern browsers require returnValue to be set to show the prompt
      e.returnValue = 'Você tem um timer ativo. Deseja mesmo sair e deixar o timer rodando?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTimer]);
};
