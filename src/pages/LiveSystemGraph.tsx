import { useRef, useState } from 'react';
import type { GraphCanvasRef } from 'reagraph';
import { useSystemGraphSocket } from '@/hooks/useSystemGraphSocket';
import { GraphView } from '@/components/systemGraph/GraphView';

export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const [selections, setSelections] = useState<string[]>([]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border/40">
        <h1 className="text-lg font-bold">Live System Graph</h1>
        <p className="text-xs text-muted-foreground">
          Conexão: {status === 'open' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'desconectado'}
        </p>
      </div>
      <div className="flex-1 relative">
        <GraphView
          ref={graphRef}
          selections={selections}
          actives={[]}
          onCanvasClick={() => setSelections([])}
        />
      </div>
    </div>
  );
}
