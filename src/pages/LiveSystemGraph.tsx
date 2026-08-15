import { useRef, useState } from 'react';
import type { GraphCanvasRef } from 'reagraph';
import { useSystemGraphSocket } from '@/hooks/useSystemGraphSocket';
import { GraphView } from '@/components/systemGraph/GraphView';
import { NodeDetailsSheet } from '@/components/systemGraph/NodeDetailsSheet';
import { EventLogPanel } from '@/components/systemGraph/EventLogPanel';
import { LegendPanel } from '@/components/systemGraph/LegendPanel';
import { useSystemGraphStore } from '@/lib/systemGraph/store';
import type { ArchNode } from '@/lib/systemGraph/architecture';

export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const [selections, setSelections] = useState<string[]>([]);
  const [detailsNode, setDetailsNode] = useState<ArchNode | null>(null);
  const nodeStatus = useSystemGraphStore(s => s.nodeStatus);
  const activeEdgeIds = useSystemGraphStore(s => s.activeEdgeIds);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border/40">
        <h1 className="text-lg font-bold">Live System Graph</h1>
        <p className="text-xs text-muted-foreground">
          Conexão: {status === 'open' ? 'ao vivo' : status === 'connecting' ? 'conectando…' : 'desconectado'}
        </p>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <GraphView
            ref={graphRef}
            selections={selections}
            actives={activeEdgeIds}
            nodeStatus={nodeStatus}
            onNodeClick={(node) => setDetailsNode(node)}
            onCanvasClick={() => setSelections([])}
          />
          <LegendPanel />
        </div>
        <EventLogPanel />
      </div>
      <NodeDetailsSheet node={detailsNode} open={!!detailsNode} onClose={() => setDetailsNode(null)} />
    </div>
  );
}
