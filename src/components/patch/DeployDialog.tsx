import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Play, Package, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useDeployPackage, type SoftwarePackage } from '@/hooks/usePatchManagement';
import { useMonitoringGroups, useGroupMachines } from '@/hooks/useMonitoring';

interface Props {
  pkg: SoftwarePackage | null;
  deployedBy?: { id?: string; name?: string };
  onClose: () => void;
}

export const DeployDialog: React.FC<Props> = ({ pkg, deployedBy, onClose }) => {
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState('');

  const { data: groups = [] } = useMonitoringGroups();
  const { data: machines = [] } = useGroupMachines(selectedGroupId || null);
  const deployMutation = useDeployPackage();

  const handleGroupChange = (v: string) => {
    setSelectedGroupId(v === 'none' ? '' : v);
    setSelectedMachineId('');
  };

  const handleDeploy = () => {
    if (!pkg || !selectedMachineId) return;
    deployMutation.mutate(
      {
        package_id: pkg.id,
        machine_id: selectedMachineId,
        sha256_hash: pkg.sha256_hash,
        file_path: pkg.file_path,
        type: pkg.type,
        executed_by_user_id: deployedBy?.id,
        executed_by_name: deployedBy?.name ?? 'Técnico',
        dispatched_by: deployedBy?.id,
      },
      {
        onSuccess: () => {
          toast({ title: '✅ Implantação disparada!', description: `O pacote "${pkg.name}" foi enviado para a máquina selecionada.` });
          setSelectedGroupId('');
          setSelectedMachineId('');
          onClose();
        },
        onError: (err: any) => toast({ title: 'Erro ao implantar', description: err.message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={!!pkg} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Implantar Pacote
          </DialogTitle>
        </DialogHeader>

        {pkg && (
          <div className="space-y-5 py-2">
            {/* Package summary */}
            <div className="p-3 bg-muted/30 rounded-xl border border-border/40 flex items-center gap-3">
              <Package className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-sm">{pkg.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">SHA-256: {pkg.sha256_hash.substring(0, 24)}…</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
            </div>

            {/* Security notice */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O agente Orion validará o hash SHA-256 localmente antes de executar. Certifique-se de que a máquina está online.
              </p>
            </div>

            {/* Target selection */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Grupo / Cliente</Label>
                <Select value={selectedGroupId || 'none'} onValueChange={handleGroupChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione um grupo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedGroupId && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider">Máquina de Destino</Label>
                  <Select value={selectedMachineId || 'none'} onValueChange={v => setSelectedMachineId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma máquina..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione...</SelectItem>
                      {machines.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            <span className={cn('w-1.5 h-1.5 rounded-full', m.status === 'online' ? 'bg-green-500' : 'bg-red-500')} />
                            {m.hostname}
                            {m.status === 'offline' && <span className="text-[10px] text-red-400">(offline)</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleDeploy} disabled={!selectedMachineId || deployMutation.isPending} className="gap-2">
            {deployMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {deployMutation.isPending ? 'Disparando...' : 'Confirmar Implantação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
