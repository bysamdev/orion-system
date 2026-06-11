import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';
import { TopBar } from '@/components/dashboard/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Package, Plus, Trash2, Loader2, ShieldCheck, Upload,
  Hash, Play, AlertTriangle, CheckCircle2, Clock, Lock,
  FileCode, Terminal, RefreshCw,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useGroupMachines, useMonitoringGroups } from '@/hooks/useMonitoring';

// ── Types ─────────────────────────────────────────────────
interface SoftwarePackage {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  type: 'powershell' | 'batch' | 'installer';
  file_path: string | null;
  sha256_hash: string;
  deploy_count: number;
  created_by: string | null;
  created_at: string;
}

interface PackageDeployment {
  id: string;
  package_id: string;
  machine_id: string;
  status: string;
  dispatched_at: string;
  completed_at: string | null;
  software_packages?: { name: string };
}

// ── Helpers ───────────────────────────────────────────────
const TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  powershell: { label: 'PowerShell (.ps1)', icon: Terminal,  color: 'text-blue-500' },
  batch:      { label: 'Batch (.bat/.cmd)',  icon: FileCode,  color: 'text-green-500' },
  installer:  { label: 'Instalador (.msi)',  icon: Package,   color: 'text-purple-500' },
};

const STATUS_STYLE: Record<string, string> = {
  pending:    'bg-amber-500/10 text-amber-600 border-amber-500/30',
  dispatched: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  completed:  'bg-green-500/10 text-green-600 border-green-500/30',
  failed:     'bg-red-500/10 text-red-600 border-red-500/30',
};

// ── Package Card ──────────────────────────────────────────
function PackageCard({
  pkg,
  onDeploy,
  onDelete,
}: {
  pkg: SoftwarePackage;
  onDeploy: (pkg: SoftwarePackage) => void;
  onDelete: (id: string) => void;
}) {
  const meta = TYPE_LABELS[pkg.type] ?? TYPE_LABELS.batch;
  const Icon = meta.icon;
  return (
    <Card className="border-border/50 hover:border-primary/30 transition-all group">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn('p-3 rounded-xl bg-muted/30 flex-shrink-0 transition-colors group-hover:bg-primary/10', meta.color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-sm truncate">{pkg.name}</h3>
              <Badge variant="outline" className={cn('text-[9px] font-bold shrink-0', meta.color)}>
                {meta.label}
              </Badge>
            </div>
            {pkg.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{pkg.description}</p>
            )}
            {/* SHA-256 hash display */}
            <div className="flex items-center gap-1.5 mb-3">
              <Hash className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[9px] font-mono text-muted-foreground/60 truncate">
                SHA-256: {pkg.sha256_hash.substring(0, 16)}…{pkg.sha256_hash.slice(-8)}
              </span>
              <ShieldCheck className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Play className="w-2.5 h-2.5" /> {pkg.deploy_count} deploys
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDistanceToNow(new Date(pkg.created_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" className="h-7 gap-1.5 text-[11px] font-bold" onClick={() => onDeploy(pkg)}>
                  <Play className="w-3 h-3" /> Implantar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => { if (confirm(`Remover o pacote "${pkg.name}"?`)) onDelete(pkg.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Deploy Dialog ─────────────────────────────────────────
function DeployDialog({
  pkg,
  companyId,
  onClose,
}: {
  pkg: SoftwarePackage | null;
  companyId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile } = useUserProfile();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const { data: groups = [] } = useMonitoringGroups();
  const { data: machines = [] } = useGroupMachines(selectedGroupId || null);

  const handleDeploy = async () => {
    if (!pkg || !selectedMachineId) return;
    setDeploying(true);
    try {
      // 1. Insert deployment record
      const { data: dep, error: depErr } = await supabase
        .from('package_deployments')
        .insert([{
          package_id: pkg.id,
          machine_id: selectedMachineId,
          status: 'dispatched',
          dispatched_by: profile?.id,
        }])
        .select('id')
        .single();
      if (depErr) throw depErr;

      // 2. Dispatch command to the machine via machine_commands
      //    The agent sees it as a regular command: "orion-install <sha256> <file_path>"
      const { error: cmdErr } = await supabase
        .from('machine_commands')
        .insert([{
          machine_id: selectedMachineId,
          command: `orion-install ${pkg.sha256_hash} "${pkg.file_path}" "${pkg.type}"`,
          executed_by_user_id: profile?.id,
          executed_by_name: profile?.full_name ?? 'Técnico',
        }]);
      if (cmdErr) throw cmdErr;

      // 3. Increment deploy_count
      await supabase.rpc('increment', { table: 'software_packages', row_id: pkg.id, column: 'deploy_count' }).maybeSingle();

      toast({ title: '✅ Implantação disparada!', description: `O pacote "${pkg.name}" foi enviado para a máquina selecionada.` });
      qc.invalidateQueries({ queryKey: ['packages'] });
      qc.invalidateQueries({ queryKey: ['package-deployments'] });
      onClose();
    } catch (err: any) {
      toast({ title: 'Erro ao implantar', description: err.message, variant: 'destructive' });
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Dialog open={!!pkg} onOpenChange={(v) => !v && onClose()}>
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

            {/* Security warning */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O agente Orion validará o hash SHA-256 localmente antes de executar. Certifique-se de que a máquina está online e o agente está na versão mais recente.
              </p>
            </div>

            {/* Target selection */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Grupo / Cliente</Label>
                <Select value={selectedGroupId || 'none'} onValueChange={v => { setSelectedGroupId(v === 'none' ? '' : v); setSelectedMachineId(''); }}>
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
          <Button
            onClick={handleDeploy}
            disabled={!selectedMachineId || deploying}
            className="gap-2"
          >
            {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {deploying ? 'Disparando...' : 'Confirmar Implantação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── New Package Dialog ────────────────────────────────────
function NewPackageDialog({
  open,
  companyId,
  onClose,
}: {
  open: boolean;
  companyId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile } = useUserProfile();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'powershell' | 'batch' | 'installer'>('powershell');
  const [hash, setHash] = useState('');
  const [filePath, setFilePath] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setDescription(''); setType('powershell'); setHash(''); setFilePath(''); };

  const handleSave = async () => {
    if (!name.trim() || !hash.trim()) {
      toast({ title: 'Preencha nome e hash SHA-256', variant: 'destructive' }); return;
    }
    if (!/^[a-f0-9]{64}$/i.test(hash.trim())) {
      toast({ title: 'Hash SHA-256 inválido', description: 'Deve ter 64 caracteres hexadecimais.', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('software_packages').insert([{
        company_id: companyId,
        name: name.trim(),
        description: description.trim() || null,
        type,
        file_path: filePath.trim() || null,
        sha256_hash: hash.trim().toLowerCase(),
        created_by: profile?.id,
      }]);
      if (error) throw error;
      toast({ title: 'Pacote cadastrado!' });
      qc.invalidateQueries({ queryKey: ['packages'] });
      reset();
      onClose();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo Pacote de Software
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Instalar Chrome Enterprise" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Tipo</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                  <SelectItem value="batch">Batch</SelectItem>
                  <SelectItem value="installer">Instalador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o que este pacote faz..." className="resize-none h-20" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Caminho do Arquivo (Storage)</Label>
            <Input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder="Ex: orion-packages/chrome-enterprise.msi" className="font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-3.5 h-3.5" /> Hash SHA-256 *
            </Label>
            <Input
              value={hash}
              onChange={e => setHash(e.target.value)}
              placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
              className={cn('font-mono text-xs', hash && !/^[a-f0-9]{64}$/i.test(hash) && 'border-red-500')}
            />
            <p className="text-[10px] text-muted-foreground">
              Execute <code className="bg-muted px-1 rounded">Get-FileHash arquivo.msi -Algorithm SHA256</code> no PowerShell para obter o hash.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O agente Orion verificará o hash SHA-256 do arquivo baixado antes de qualquer execução. Se o hash não corresponder, o arquivo será descartado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cadastrar Pacote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────
const PatchManagement: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile } = useUserProfile();
  const companyId = profile?.company_id ?? '';
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [deployingPkg, setDeployingPkg] = useState<SoftwarePackage | null>(null);

  const { data: packages = [], isLoading: pkgsLoading } = useQuery<SoftwarePackage[]>({
    queryKey: ['packages', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('software_packages')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

  const { data: deployments = [], isLoading: deplLoading } = useQuery<PackageDeployment[]>({
    queryKey: ['package-deployments', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_deployments')
        .select('*, software_packages(name)')
        .order('dispatched_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!companyId,
    refetchInterval: 15_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('software_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast({ title: 'Pacote removido' });
    },
    onError: (err: any) => toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' }),
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Restrict to admin/developer only
  if (!role || !['admin', 'developer'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 space-y-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          O Gerenciamento de Patches requer privilégios de Administrador ou Desenvolvedor.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-500/30">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Gerenciamento de Patches</h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                Scripts · Instaladores · Implantação Remota
              </p>
            </div>
          </div>
          <Button onClick={() => setNewDialogOpen(true)} className="gap-2 font-bold">
            <Plus className="w-4 h-4" /> Novo Pacote
          </Button>
        </div>

        {/* Security reminder banner */}
        <div className="mb-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Verificação de Segurança Ativa</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Todos os pacotes exigem um hash SHA-256 cadastrado. O agente Orion valida o arquivo localmente antes de qualquer execução.
              Acesso restrito a <strong>Administradores</strong> e <strong>Desenvolvedores</strong>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Package list */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Pacotes Cadastrados</h2>
              <Badge variant="secondary">{packages.length}</Badge>
            </div>

            {pkgsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
            ) : packages.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="p-4 bg-muted/30 rounded-full"><Package className="w-8 h-8 text-muted-foreground/40" /></div>
                  <div>
                    <p className="font-bold">Nenhum pacote cadastrado</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Cadastre scripts PowerShell, Batch ou instaladores MSI para implantação remota.
                    </p>
                  </div>
                  <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Cadastrar Primeiro Pacote
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {packages.map(pkg => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onDeploy={setDeployingPkg}
                    onDelete={id => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Deployment log */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Log de Implantações</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => qc.invalidateQueries({ queryKey: ['package-deployments'] })}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Card className="border-border/50">
              <ScrollArea className="h-[500px]">
                {deplLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary/50" /></div>
                ) : deployments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-center p-4">
                    <Clock className="w-8 h-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">Nenhuma implantação realizada ainda</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Pacote</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Status</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest">Quando</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deployments.map(dep => (
                        <TableRow key={dep.id} className="hover:bg-muted/10">
                          <TableCell className="text-xs font-semibold max-w-[120px] truncate">
                            {dep.software_packages?.name ?? '—'}
                          </TableCell>
                          <TableCell>
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', STATUS_STYLE[dep.status] ?? 'border-border text-muted-foreground')}>
                              {dep.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(dep.dispatched_at), { locale: ptBR, addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </Card>
          </div>
        </div>
      </main>

      <NewPackageDialog open={newDialogOpen} companyId={companyId} onClose={() => setNewDialogOpen(false)} />
      <DeployDialog pkg={deployingPkg} companyId={companyId} onClose={() => setDeployingPkg(null)} />
    </div>
  );
};

export default PatchManagement;
