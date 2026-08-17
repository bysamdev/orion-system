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

export type LayoutMode = 'forceDirected3d' | 'forceDirected2d' | 'radialOut2d';

interface GraphCanvasViewProps {
  selections?: string[];
  actives?: string[];
  activeEdgeIds?: string[];
  nodeStatus?: Record<string, NodeStatus>;
  layoutMode?: LayoutMode;
  speedMultiplier?: number;
  onNodeClick?: (node: ArchNode) => void;
  onCanvasClick?: () => void;
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: '',
  processing: '#fbbf24', // Glowing Amber
  success: '#22c55e',    // Emerald Green
  error: '#ef4444',      // Red Alert
};

export const GraphCanvasView = forwardRef<GraphCanvasRef, GraphCanvasViewProps>(
  function GraphCanvasView(
    {
      selections = [],
      actives = [],
      activeEdgeIds = [],
      nodeStatus = {},
      layoutMode = 'forceDirected3d',
      speedMultiplier = 1.0,
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

          // Dynamic prominent sizing
          let nodeSize = 15;
          if (node.id === 'db-supabase-postgres' || node.id === 'hnd-router' || node.id === 'app-shell') {
            nodeSize = 22;
          } else if (node.kind === 'database' || node.kind === 'backend') {
            nodeSize = 18;
          } else if (node.kind === 'ai') {
            nodeSize = 17;
          }

          return {
            id: node.id,
            label: node.label,
            subLabel: node.tech || node.kind.toUpperCase(),
            fill: dynamicFill,
            size: nodeSize,
            data: node,
          };
        }),
      [nodeStatus]
    );

    const activeSet = useMemo(() => new Set(activeEdgeIds), [activeEdgeIds]);

    const reaEdges: GraphEdge[] = useMemo(
      () =>
        ARCH_EDGES.map(edge => {
          const isActive = activeSet.has(edge.id);
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.protocol || edge.label,
            size: isActive ? 3.5 : 1.8,
            fill: isActive ? '#38bdf8' : '#334155',
          };
        }),
      [activeSet]
    );

    return (
      <div className="w-full h-full relative">
        <GraphCanvas
          ref={ref}
          nodes={reaNodes}
          edges={reaEdges}
          layoutType={layoutMode}
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
              inactiveOpacity: 0.2,
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
              opacity: 0.75,
              selectedOpacity: 1,
              inactiveOpacity: 0.1,
              label: {
                color: '#94a3b8',
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
              background: 'rgba(99, 102, 241, 0.15)',
              border: '#6366f1',
            },
          }}
          onNodeClick={node => onNodeClick?.(node.data as ArchNode)}
          onCanvasClick={() => onCanvasClick?.()}
        >
          <EdgeParticles activeEdgeIds={activeEdgeIds} speedMultiplier={speedMultiplier} />
        </GraphCanvas>
      </div>
    );
  }
);
