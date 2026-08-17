import { forwardRef, useMemo, memo } from 'react';
import {
  GraphCanvas,
  type GraphCanvasRef,
  type GraphNode,
  type GraphEdge,
} from 'reagraph';
import { ARCH_NODES, ARCH_EDGES, KIND_COLORS } from '../architecture';
import type { ArchNode } from '../types';
import { EdgeParticles } from './EdgeParticles';

export type LayoutMode = 'forceDirected3d' | 'forceDirected2d' | 'radialOut2d';

interface GraphCanvasViewProps {
  selections?: string[];
  actives?: string[];
  activeEdgeIds?: string[];
  layoutMode?: LayoutMode;
  speedMultiplier?: number;
  onNodeClick?: (node: ArchNode) => void;
  onCanvasClick?: () => void;
}

export const GraphCanvasView = memo(
  forwardRef<GraphCanvasRef, GraphCanvasViewProps>(function GraphCanvasView(
    {
      selections = [],
      actives = [],
      activeEdgeIds = [],
      layoutMode = 'forceDirected3d',
      speedMultiplier = 1.0,
      onNodeClick,
      onCanvasClick,
    },
    ref
  ) {
    // Stable static nodes - avoids restarting d3-force layout on dynamic simulation pulses!
    const reaNodes: GraphNode[] = useMemo(
      () =>
        ARCH_NODES.map(node => {
          let nodeSize = 14;
          if (node.id === 'db-supabase-postgres' || node.id === 'hnd-router' || node.id === 'app-shell') {
            nodeSize = 20;
          } else if (node.kind === 'database' || node.kind === 'backend') {
            nodeSize = 17;
          } else if (node.kind === 'ai') {
            nodeSize = 16;
          }

          return {
            id: node.id,
            label: node.label,
            subLabel: node.tech || node.kind.toUpperCase(),
            fill: KIND_COLORS[node.kind],
            size: nodeSize,
            data: node,
          };
        }),
      []
    );

    const reaEdges: GraphEdge[] = useMemo(
      () =>
        ARCH_EDGES.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.protocol || edge.label,
          size: 1.8,
          fill: '#334155',
        })),
      []
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
              opacity: 0.7,
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
  })
);
