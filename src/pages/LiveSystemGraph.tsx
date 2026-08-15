import { useRef, useState } from 'react';
import type { GraphCanvasRef } from 'reagraph';
import { useSelection } from 'reagraph';
import { useSystemGraphSocket } from '@/hooks/useSystemGraphSocket';
import { GraphView } from '@/components/systemGraph/GraphView';
import { NodeDetailsSheet } from '@/components/systemGraph/NodeDetailsSheet';
import { EventLogPanel } from '@/components/systemGraph/EventLogPanel';
import { LegendPanel } from '@/components/systemGraph/LegendPanel';
import { GraphToolbar } from '@/components/systemGraph/GraphToolbar';
import { useSystemGraphStore } from '@/lib/systemGraph/store';
import { ARCH_NODES, ARCH_EDGES } from '@/lib/systemGraph/architecture';
import type { ArchNode } from '@/lib/systemGraph/architecture';

export default function LiveSystemGraph() {
  const { status } = useSystemGraphSocket();
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const nodeStatus = useSystemGraphStore(s => s.nodeStatus);
  const activeEdgeIds = useSystemGraphStore(s => s.activeEdgeIds);
  const [detailsNode, setDetailsNode] = useState<ArchNode | null>(null);
  const [pathSource, setPathSource] = useState<string | null>(null);

  const { selections, actives: pathActives, selectNodePaths, clearSelections } = useSelection({
    ref: graphRef,
    nodes: ARCH_NODES,
    edges: ARCH_EDGES,
    pathSelectionType: 'all',
  });

  const handleNodeClick = (node: ArchNode) => {
    if (!pathSource) {
      setPathSource(node.id);
      return;
    }
    if (node.id === pathSource) {
      setPathSource(null);
      clearSelections();
      return;
    }
    selectNodePaths(pathSource, node.id);
    setDetailsNode(node);
  };

  const clearPath = () => {
    setPathSource(null);
    clearSelections();
  };

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
            actives={[...activeEdgeIds, ...pathActives]}
            nodeStatus={nodeStatus}
            onNodeClick={handleNodeClick}
            onCanvasClick={clearPath}
          />
          <LegendPanel />
          <GraphToolbar pathSource={pathSource} pathTarget={selections[selections.length - 1] ?? null} onClear={clearPath} />
        </div>
        <EventLogPanel />
      </div>
      <NodeDetailsSheet node={detailsNode} open={!!detailsNode} onClose={() => setDetailsNode(null)} />
    </div>
  );
}
