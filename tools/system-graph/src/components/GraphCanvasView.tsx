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
  onNodeHover?: (node: ArchNode | null) => void;
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
      onNodeHover,
      onCanvasClick,
    },
    ref
  ) {
    // Highly visible and scaled node sizing
    const reaNodes: GraphNode[] = useMemo(
      () =>
        ARCH_NODES.map(node => {
          let nodeSize = 22;
          if (node.id === 'db-supabase-postgres' || node.id === 'hnd-router' || node.id === 'app-shell') {
            nodeSize = 34; // Master Hub
          } else if (node.kind === 'database' || node.kind === 'backend') {
            nodeSize = 27;
          } else if (node.kind === 'ai') {
            nodeSize = 26;
          } else if (node.kind === 'service') {
            nodeSize = 24;
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
            size: isActive ? 4.8 : 2.6,
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
          draggable={true}
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
              opacity: 0.75,
              selectedOpacity: 1,
              inactiveOpacity: 0.15,
              label: {
                color: '#cbd5e1',
                stroke: '#090d16',
                activeColor: '#38bdf8',
              },
            },
            arrow: {
              fill: '#64748b',
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
          onNodePointerOver={node => onNodeHover?.(node.data as ArchNode)}
          onNodePointerOut={() => onNodeHover?.(null)}
          onCanvasClick={() => onCanvasClick?.()}
        >
          <EdgeParticles activeEdgeIds={activeEdgeIds} speedMultiplier={speedMultiplier} />
        </GraphCanvas>
      </div>
    );
  })
);
