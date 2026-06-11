import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hash, Play, Clock, ShieldCheck, Trash2, Package, Terminal, FileCode } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { type SoftwarePackage, type PackageType } from '@/hooks/usePatchManagement';

const TYPE_META: Record<PackageType, { label: string; icon: React.ElementType; color: string }> = {
  powershell: { label: 'PowerShell (.ps1)', icon: Terminal,  color: 'text-blue-500' },
  batch:      { label: 'Batch (.bat/.cmd)',  icon: FileCode,  color: 'text-green-500' },
  installer:  { label: 'Instalador (.msi)',  icon: Package,   color: 'text-purple-500' },
};

interface Props {
  pkg: SoftwarePackage;
  onDeploy: (pkg: SoftwarePackage) => void;
  onDelete: (id: string) => void;
}

export const PackageCard: React.FC<Props> = ({ pkg, onDeploy, onDelete }) => {
  const meta = TYPE_META[pkg.type] ?? TYPE_META.batch;
  const Icon = meta.icon;

  const handleDelete = () => {
    if (confirm(`Remover o pacote "${pkg.name}"?`)) onDelete(pkg.id);
  };

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
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
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
};
