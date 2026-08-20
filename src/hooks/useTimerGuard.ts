import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { toast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const useTimerGuard = () => {
  const { user } = useAuth();
  const { data: activeTimer } = useActiveTimer(user?.id);
  const stopTimer = useStopTimer();

  const activeTimerRef = useRef(activeTimer);
  activeTimerRef.current = activeTimer;

  const stopTimerRef = useRef(stopTimer);
  stopTimerRef.current = stopTimer;

  const activeTimerId = activeTimer?.id;

  // Inactivity auto-pause: listeners stay stable while timer ID is active
  useEffect(() => {
    if (!activeTimerId) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        const currentActive = activeTimerRef.current;
        if (!currentActive) return;

        stopTimerRef.current.mutate({ entryId: currentActive.id });
        toast({
          title: 'Timer pausado',
          description: 'O timer foi pausado automaticamente após 30 minutos de inatividade.',
        });
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Attach listeners once when activeTimerId appears
    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });
    window.addEventListener('click', resetTimer, { passive: true });

    // Initial call to start the timeout
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, [activeTimerId]);

  // beforeunload warning
  useEffect(() => {
    if (!activeTimerId) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Você tem um timer ativo. Deseja mesmo sair e deixar o timer rodando?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTimerId]);
};
