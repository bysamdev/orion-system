import React, { useState } from 'react';
import { useUserProfile, useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Plus, ShieldCheck, RefreshCw, Clock, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSoftwarePackages, usePackageDeployments, useDeletePackage, type SoftwarePackage } from '@/hooks/usePatchManagement';
import { PackageCard } from '@/components/patch/PackageCard';
import { NewPackageDialog } from '@/components/patch/NewPackageDialog';
import { DeployDialog } from '@/components/patch/DeployDialog';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_STYLE: Record<string, string> = {
  pending:    'bg-amber-500/10 text-amber-600 border-amber-500/30',
  dispatched: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  completed:  'bg-green-500/10 text-green-600 border-green-500/30',
  failed:     'bg-red-500/10 text-red-600 border-red-500/30',
};

const PatchManagement: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile } = useUserProfile();
  const companyId = profile?.company_id ?? '';

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [deployingPkg, setDeployingPkg] = useState<SoftwarePackage | null>(null);

  const { data: packages = [], isLoading: pkgsLoading } = useSoftwarePackages(companyId);
  const { data: deployments = [], isLoading: deplLoading } = usePackageDeployments(companyId);
  const deleteMutation = useDeletePackage(companyId);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: 'Pacote removido' }),
      onError: (err: Error) => toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' }),
    });
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role || !['admin', 'developer', 'technician'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 space-y-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          O Gerenciamento de Patches requer privilégios de Administrador, Desenvolvedor ou Técnico.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">

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
          <ButtonPrimary onClick={() => setNewDialogOpen(true)} className="gap-2 font-bold" icon={<Plus className="w-4 h-4" />}>
            Novo Pacote
          </ButtonPrimary>
        </div>

        {/* Security banner */}
        <div className="mb-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Verificação de Segurança Ativa</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Todos os pacotes exigem hash SHA-256. O agente Orion valida o arquivo antes de qualquer execução.
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
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">Cadastre scripts ou instaladores para implantação remota.</p>
                  </div>
                  <ButtonPrimary onClick={() => setNewDialogOpen(true)} className="gap-2" icon={<Plus className="w-4 h-4" />}>
                    Cadastrar Primeiro Pacote
                  </ButtonPrimary>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {packages.map(pkg => (
                  <PackageCard key={pkg.id} pkg={pkg} onDeploy={setDeployingPkg} onDelete={handleDelete} />
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

      <NewPackageDialog
        open={newDialogOpen}
        companyId={companyId}
        userId={profile?.id}
        onClose={() => setNewDialogOpen(false)}
      />
      <DeployDialog
        pkg={deployingPkg}
        deployedBy={{ id: profile?.id, name: profile?.full_name }}
        onClose={() => setDeployingPkg(null)}
      />
    </div>
  );
};

export default PatchManagement;
