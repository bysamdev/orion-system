import { useMemo, useState } from 'react';
import { DownloadCloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAllMachines, useForceUpdateOutdated, useMonitoringDashboard } from '@/hooks/useMonitoring';

// Botão "Atualizar todas" — força o enfileiramento de atualização em toda
// máquina desatualizada do escopo do chamador de uma vez, sem esperar o
// próximo heartbeat de cada uma detectar a divergência sozinho (o normal
// já funciona, mas pode demorar até ~30-60s por máquina, e o admin às
// vezes só quer confirmar que todas vão convergir agora).
export function ForceUpdateButton() {
  const { data: machines = [] } = useAllMachines();
  const { data: dashboard } = useMonitoringDashboard();
  const forceUpdate = useForceUpdateOutdated();
  const [open, setOpen] = useState(false);

  const latestVersion = dashboard?.latest_agent_version;

  const desatualizadas = useMemo(() => {
    if (!latestVersion) return 0;
    return machines.filter((m) => m.agent_version && m.agent_version !== latestVersion).length;
  }, [machines, latestVersion]);

  if (desatualizadas === 0) return null;

  const handleConfirm = async () => {
    try {
      const result = await forceUpdate.mutateAsync();
      setOpen(false);
      if (result.errors.length > 0) {
        toast.warning(`${result.enqueued} atualização(ões) enfileirada(s), ${result.errors.length} com erro`, {
          description: result.errors.slice(0, 3).join('; '),
        });
      } else if (result.enqueued === 0) {
        toast.info('Nenhuma atualização nova enfileirada — todas já têm uma em trânsito');
      } else {
        toast.success(`${result.enqueued} atualização(ões) enfileirada(s)`, {
          description: 'Cada máquina aplica no próximo poll de comandos (até 30s).',
        });
      }
    } catch (error) {
      toast.error('Erro ao forçar atualização', { description: (error as Error).message });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-warning/30 text-warning hover:bg-warning/10 transition-all font-semibold"
        >
          <DownloadCloud className="w-4 h-4" />
          Atualizar todas
          <Badge variant="warning" className="ml-0.5">
            {desatualizadas}
          </Badge>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Forçar atualização em {desatualizadas} máquina(s)?</AlertDialogTitle>
          <AlertDialogDescription>
            Enfileira o instalador mais recente pra toda máquina com versão diferente de{' '}
            <code className="text-xs font-mono">{latestVersion}</code>. Cada uma aplica sozinha no
            próximo poll de comandos (até 30s) — não precisa de ação manual na máquina.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={forceUpdate.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={forceUpdate.isPending} className="gap-2">
            {forceUpdate.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Atualizar todas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
