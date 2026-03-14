import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, Timer, Plus, Clock, Save, Loader2 } from 'lucide-react';
import { useActiveTimer, useStartTimer, useStopTimer, useTicketTimeEntries } from '@/hooks/useTimeEntries';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface TimeTrackerProps {
  ticketId: string;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({ ticketId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: activeTimer, isLoading: loadingTimer } = useActiveTimer(user?.id);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  
  const [elapsed, setElapsed] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (activeTimer && activeTimer.ticket_id === ticketId) {
      const startTime = new Date(activeTimer.start_time).getTime();
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeTimer, ticketId]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!user) return;
    await startTimer.mutateAsync({ ticketId, userId: user.id });
  };

  const handleStop = async () => {
    if (!activeTimer) return;
    await stopTimer.mutateAsync({ entryId: activeTimer.id });
  };

  const handleManualAdd = async () => {
    if (!user || !manualMinutes) return;
    setIsAddingManual(true);
    try {
      const { error } = await supabase.from('time_entries').insert({
        ticket_id: ticketId,
        user_id: user.id,
        duration_minutes: parseInt(manualMinutes),
        description: manualDescription,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        billable: true
      });
      if (error) throw error;
      toast({ title: 'Apontamento registrado', description: `${manualMinutes} minutos adicionados.` });
      queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
      setManualMinutes('');
      setManualDescription('');
      setShowManual(false);
    } catch (e) {
      toast({ title: 'Erro ao registrar', variant: 'destructive' });
    } finally {
      setIsAddingManual(false);
    }
  };

  const isCurrentTicketActive = activeTimer && activeTimer.ticket_id === ticketId;
  const isAnotherTicketActive = activeTimer && activeTimer.ticket_id !== ticketId;

  if (loadingTimer) return <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-4">
      <Card className={cn(
        "border-none shadow-none transition-all",
        isCurrentTicketActive ? "bg-primary/10 border-l-4 border-l-primary" : "bg-muted/30"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                isCurrentTicketActive ? "bg-primary text-primary-foreground animate-pulse" : "bg-background border border-border/40 text-muted-foreground"
              )}>
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Cronômetro</p>
                <p className="text-xl font-black tabular-nums tracking-tighter">
                  {isCurrentTicketActive ? formatElapsed(elapsed) : '00:00:00'}
                </p>
              </div>
            </div>

            {isCurrentTicketActive ? (
              <Button size="sm" onClick={handleStop} variant="destructive" className="h-10 px-4 rounded-xl font-bold gap-2">
                <Square className="w-4 h-4 fill-current" /> Parar
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={handleStart} 
                disabled={isAnotherTicketActive || startTimer.isPending}
                className="h-10 px-4 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
              >
                <Play className="w-4 h-4 fill-current" /> Iniciar
              </Button>
            )}
          </div>
          {isAnotherTicketActive && (
            <p className="text-[9px] text-destructive font-bold mt-2 uppercase tracking-tight">
              ⚠️ Existe um timer ativo em outro chamado
            </p>
          )}
        </CardContent>
      </Card>

      {!showManual ? (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowManual(true)}
          className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary rounded-xl gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Lançamento Manual
        </Button>
      ) : (
        <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest">Adicionar Horas</h4>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Input 
              placeholder="Min" 
              type="number" 
              value={manualMinutes} 
              onChange={e => setManualMinutes(e.target.value)}
              className="col-span-1 h-9 rounded-lg bg-background border-border/40 transition-all focus-visible:ring-primary/20"
            />
            <Input 
              placeholder="O que foi feito?" 
              value={manualDescription} 
              onChange={e => setManualDescription(e.target.value)}
              className="col-span-3 h-9 rounded-lg bg-background border-border/40 transition-all focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleManualAdd} disabled={isAddingManual} className="flex-1 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider">
              {isAddingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowManual(false)} className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider">
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
