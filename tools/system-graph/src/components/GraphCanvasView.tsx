import { forwardRef, useMemo } from 'react';
import {
  GraphCanvas,
  type GraphCanvasRef,
  type GraphNode,
  type GraphEdge,
} from 'reagraph';
import { ARCH_NODES, ARCH_EDGES, KIND_COLORS } from '../architecture';
import type { ArchNode, NodeStatus } from '../types';
import { EdgeParticles } from './EdgeParticles';

interface GraphCanvasViewProps {
  selections?: string[];
  actives?: string[];
  activeEdgeIds?: string[];
  nodeStatus?: Record<string, NodeStatus>;
  onNodeClick?: (node: ArchNode) => void;
  onCanvasClick?: () => void;
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: '',
  processing: '#fbbf24', // Amber
  success: '#22c55e',    // Green
  error: '#ef4444',      // Red
};

export const GraphCanvasView = forwardRef<GraphCanvasRef, GraphCanvasViewProps>(
  function GraphCanvasView(
    {
      selections = [],
      actives = [],
      activeEdgeIds = [],
      nodeStatus = {},
      onNodeClick,
      onCanvasClick,
    },
    ref
  ) {
    const reaNodes: GraphNode[] = useMemo(
      () =>
        ARCH_NODES.map(node => {
          const status = nodeStatus[node.id] || 'idle';
          const dynamicFill = status !== 'idle' ? STATUS_COLORS[status] : KIND_COLORS[node.kind];

          return {
            id: node.id,
            label: node.label,
            subLabel: node.kind.toUpperCase(),
            fill: dynamicFill,
            size: node.kind === 'database' || node.kind === 'backend' ? 9 : 7.5,
            data: node,
          };
        }),
      [nodeStatus]
    );

    const reaEdges: GraphEdge[] = useMemo(
      () =>
        ARCH_EDGES.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          size: 1.2,
        })),
      []
    );

    return (
      <div className="w-full h-full relative">
        <GraphCanvas
          ref={ref}
          nodes={reaNodes}
          edges={reaEdges}
          layoutType="forceDirected3d"
          cameraMode="orbit"
          selections={selections}
          actives={actives}
          theme={{
            canvas: {
              background: '#090d16',
              fog: '#090d16',
            },
            node: {
              fill: '#6366f1',
              activeFill: '#38bdf8',
              opacity: 0.95,
              selectedOpacity: 1,
              inactiveOpacity: 0.25,
              label: {
                color: '#f8fafc',
                stroke: '#090d16',
                activeColor: '#38bdf8',
              },
              subLabel: {
                color: '#94a3b8',
                stroke: '#090d16',
                activeColor: '#38bdf8',
              },
            },
            edge: {
              fill: '#334155',
              activeFill: '#38bdf8',
              opacity: 0.7,
              selectedOpacity: 1,
              inactiveOpacity: 0.1,
              label: {
                color: '#cbd5e1',
                stroke: '#090d16',
                activeColor: '#38bdf8',
              },
            },
            arrow: {
              fill: '#475569',
              activeFill: '#38bdf8',
            },
            ring: {
              fill: '#38bdf8',
              activeFill: '#60a5fa',
            },
            lasso: {
              background: 'rgba(99, 102, 241, 0.1)',
              border: '#6366f1',
            },
          }}
          onNodeClick={node => onNodeClick?.(node.data as ArchNode)}
          onCanvasClick={() => onCanvasClick?.()}
        >
          <EdgeParticles activeEdgeIds={activeEdgeIds} />
        </GraphCanvas>
      </div>
    );
  }
);
