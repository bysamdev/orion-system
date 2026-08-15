import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface GraphToolbarProps {
  pathSource: string | null;
  pathTarget: string | null;
  onClear: () => void;
}

export function GraphToolbar({ pathSource, pathTarget, onClear }: GraphToolbarProps) {
  if (!pathSource) return null;

  return (
    <div className="absolute top-4 left-4 bg-background/90 backdrop-blur border border-border/40 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
      <span>
        {pathTarget
          ? `Caminho: ${pathSource} → ${pathTarget}`
          : `Origem selecionada: ${pathSource}. Clique em outro nó para destacar o caminho.`}
      </span>
      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClear}>
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}
