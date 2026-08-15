import { forwardRef } from 'react';
import { GraphCanvas, GraphCanvasRef, GraphNode as ReaGraphNode, GraphEdge as ReaGraphEdge } from 'reagraph';
import { ARCH_NODES, ARCH_EDGES, ArchNode, ArchEdge, NodeKind } from '@/lib/systemGraph/architecture';

export const NODE_KIND_COLOR: Record<NodeKind, string> = {
  frontend: '#3b82f6',
  backend: '#8b5cf6',
  database: '#10b981',
  service: '#f59e0b',
  api: '#06b6d4',
  ai: '#ec4899',
};

const KIND_LABEL: Record<NodeKind, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  service: 'Service',
  api: 'API',
  ai: 'AI',
};

const reaNodes: ReaGraphNode[] = ARCH_NODES.map((n: ArchNode) => ({
  id: n.id,
  label: n.label,
  subLabel: KIND_LABEL[n.kind],
  fill: NODE_KIND_COLOR[n.kind],
  data: n,
}));

const reaEdges: ReaGraphEdge[] = ARCH_EDGES.map((e: ArchEdge) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  data: e,
}));

interface GraphViewProps {
  selections: string[];
  actives: string[];
  onNodeClick?: (node: ArchNode) => void;
  onCanvasClick?: () => void;
}

export const GraphView = forwardRef<GraphCanvasRef, GraphViewProps>(
  ({ selections, actives, onNodeClick, onCanvasClick }, ref) => {
    return (
      <GraphCanvas
        ref={ref}
        nodes={reaNodes}
        edges={reaEdges}
        layoutType="forceDirected3d"
        cameraMode="orbit"
        selections={selections}
        actives={actives}
        onNodeClick={(node) => onNodeClick?.(node.data as ArchNode)}
        onCanvasClick={() => onCanvasClick?.()}
      />
    );
  }
);
GraphView.displayName = 'GraphView';
