import { NODE_KIND_COLOR } from './GraphView';
import type { NodeKind } from '@/lib/systemGraph/architecture';

const KIND_LABEL: Record<NodeKind, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  service: 'Service',
  api: 'API',
  ai: 'AI',
};

export function LegendPanel() {
  return (
    <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur border border-border/40 rounded-lg p-3 space-y-1.5">
      {(Object.keys(KIND_LABEL) as NodeKind[]).map(kind => (
        <div key={kind} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_KIND_COLOR[kind] }} />
          {KIND_LABEL[kind]}
        </div>
      ))}
    </div>
  );
}
