import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { GraphCanvasRef } from 'reagraph';
import { useSelection } from 'reagraph';
import { ARCH_NODES, ARCH_EDGES, NODE_BY_ID } from './architecture';
import type { ArchNode, NodeKind, TrafficIntensity, LiveTelemetryEvent } from './types';
import { GraphCanvasView, type LayoutMode } from './components/GraphCanvasView';
import { HUDHeader } from './components/HUDHeader';
import { LegendHUD } from './components/LegendHUD';
import { NodeInspectorSheet } from './components/NodeInspectorSheet';
import { NodeHoverCard } from './components/NodeHoverCard';
import { LiveTelemetryPanel } from './components/LiveTelemetryPanel';

const INTENSITY_CONFIG: Record<TrafficIntensity, { batchSize: number; intervalMs: number; speed: number }> = {
  low: { batchSize: 2, intervalMs: 2500, speed: 0.9 },
  normal: { batchSize: 4, intervalMs: 1600, speed: 1.3 },
  high: { batchSize: 6, intervalMs: 1000, speed: 1.8 },
  warp: { batchSize: 9, intervalMs: 600, speed: 2.6 },
};

export function App() {
  const graphRef = useRef<GraphCanvasRef | null>(null);

  // Reagraph selection hook
  const { selections, actives: pathActives, selectNodePaths, clearSelections } = useSelection({
    ref: graphRef,
    nodes: ARCH_NODES,
    edges: ARCH_EDGES,
    pathSelectionType: 'all',
  });

  // States
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ArchNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<NodeKind | 'all'>('all');
  const [isSimulating, setIsSimulating] = useState(true);
  const [trafficIntensity, setTrafficIntensity] = useState<TrafficIntensity>('normal');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('forceDirected3d');

  const [activeEdgeIds, setActiveEdgeIds] = useState<string[]>([]);
  const [telemetryEvents, setTelemetryEvents] = useState<LiveTelemetryEvent[]>([]);
  const [rps, setRps] = useState(14);

  const [pathFrom, setPathFrom] = useState<ArchNode | null>(null);
  const [pathTo, setPathTo] = useState<ArchNode | null>(null);

  // Filtered nodes by search and kind
  const filteredNodeIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ARCH_NODES.filter(node => {
      const matchesSearch =
        !query ||
        node.label.toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.tech.toLowerCase().includes(query) ||
        node.sourceRef.toLowerCase().includes(query);
      const matchesKind = selectedKind === 'all' || node.kind === selectedKind;
      return matchesSearch && matchesKind;
    }).map(n => n.id);
  }, [searchQuery, selectedKind]);

  // Combined selection IDs
  const effectiveSelections = useMemo(() => {
    if (selections && selections.length > 0) return selections;
    if (selectedNode) return [selectedNode.id];
    if (filteredNodeIds.length < ARCH_NODES.length) return filteredNodeIds;
    return [];
  }, [selections, selectedNode, filteredNodeIds]);

  // Actives (for edges & path)
  const effectiveActives = useMemo(() => {
    return Array.from(new Set([...activeEdgeIds, ...(pathActives || [])]));
  }, [activeEdgeIds, pathActives]);

  // Optimized smooth simulation loop
  useEffect(() => {
    if (!isSimulating) {
      setActiveEdgeIds([]);
      setRps(0);
      return;
    }

    const config = INTENSITY_CONFIG[trafficIntensity];
    const baseRps = trafficIntensity === 'warp' ? 72 : trafficIntensity === 'high' ? 34 : trafficIntensity === 'normal' ? 16 : 6;
    setRps(baseRps + Math.floor(Math.random() * 4));

    const interval = setInterval(() => {
      const shuffled = [...ARCH_EDGES].sort(() => 0.5 - Math.random());
      const count = Math.min(config.batchSize, shuffled.length);
      const chosenEdges = shuffled.slice(0, count);
      const newIds = chosenEdges.map(e => e.id);

      setActiveEdgeIds(prev => Array.from(new Set([...prev, ...newIds])));

      // Batch generate telemetry
      const newEvents: LiveTelemetryEvent[] = chosenEdges.map(edge => {
        const src = NODE_BY_ID.get(edge.source);
        const tgt = NODE_BY_ID.get(edge.target);
        const isDbOrAi = tgt?.kind === 'database' || tgt?.kind === 'ai';

        return {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          edgeId: edge.id,
          sourceLabel: src?.label || edge.source,
          targetLabel: tgt?.label || edge.target,
          sourceKind: src?.kind || 'frontend',
          targetKind: tgt?.kind || 'backend',
          protocol: edge.protocol || 'HTTPS / REST',
          latencyMs: isDbOrAi ? Math.floor(Math.random() * 35) + 12 : Math.floor(Math.random() * 12) + 3,
          status: isDbOrAi ? 'CACHE HIT' : '200 OK',
        };
      });

      setTelemetryEvents(prev => [...newEvents, ...prev].slice(0, 30));

      // Clean up active edges after pulse completes
      setTimeout(() => {
        setActiveEdgeIds(prev => prev.filter(id => !newIds.includes(id)));
      }, 1400 / config.speed);
    }, config.intervalMs);

    return () => clearInterval(interval);
  }, [isSimulating, trafficIntensity]);

  // Handle node selection & shortest path
  const handleNodeClick = useCallback(
    (node: ArchNode) => {
      setSelectedNode(node);

      if (!pathFrom) {
        setPathFrom(node);
      } else if (!pathTo && pathFrom.id !== node.id) {
        setPathTo(node);
        selectNodePaths(pathFrom.id, node.id);
      } else {
        setPathFrom(node);
        setPathTo(null);
        clearSelections();
      }
    },
    [pathFrom, pathTo, selectNodePaths, clearSelections]
  );

  const handleCanvasClick = useCallback(() => {
    setSelectedNode(null);
    setHoveredNode(null);
    setPathFrom(null);
    setPathTo(null);
    clearSelections();
  }, [clearSelections]);

  const handleResetView = useCallback(() => {
    setSelectedNode(null);
    setHoveredNode(null);
    setSearchQuery('');
    setSelectedKind('all');
    setPathFrom(null);
    setPathTo(null);
    clearSelections();
    try {
      graphRef.current?.centerGraph();
    } catch {
      // Ignore
    }
  }, [clearSelections]);

  const handleZoomIn = useCallback(() => {
    try {
      graphRef.current?.zoomIn();
    } catch {
      // Ignore
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    try {
      graphRef.current?.zoomOut();
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="w-screen h-screen relative bg-[#090d16] overflow-hidden">
      {/* HUD Header */}
      <HUDHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedKind={selectedKind}
        onKindChange={setSelectedKind}
        isSimulating={isSimulating}
        onToggleSimulate={() => setIsSimulating(!isSimulating)}
        trafficIntensity={trafficIntensity}
        onIntensityChange={setTrafficIntensity}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        onResetView={handleResetView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {/* Pathfinding HUD (if path selected) */}
      {pathFrom && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-xl border border-indigo-500/40 px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-sky-400 uppercase tracking-wider">Caminho de Execução:</span>
            <span className="text-white font-bold bg-slate-800 px-2.5 py-1 rounded-xl border border-white/10 shadow-sm">
              {pathFrom.label}
            </span>
            <span className="text-sky-400 font-bold">➔</span>
            {pathTo ? (
              <span className="text-white font-bold bg-slate-800 px-2.5 py-1 rounded-xl border border-white/10 shadow-sm">
                {pathTo.label}
              </span>
            ) : (
              <span className="text-slate-400 italic">Clique no 2º componente de destino...</span>
            )}
          </div>
          <button
            onClick={() => {
              setPathFrom(null);
              setPathTo(null);
              clearSelections();
            }}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all font-semibold"
          >
            Limpar Rota
          </button>
        </div>
      )}

      {/* Main 3D Graph Canvas */}
      <GraphCanvasView
        ref={graphRef}
        selections={effectiveSelections}
        actives={effectiveActives}
        activeEdgeIds={activeEdgeIds}
        layoutMode={layoutMode}
        speedMultiplier={INTENSITY_CONFIG[trafficIntensity].speed}
        onNodeClick={handleNodeClick}
        onNodeHover={setHoveredNode}
        onCanvasClick={handleCanvasClick}
      />

      {/* Quick Hover Insight Card (when not clicking inspector) */}
      {!selectedNode && hoveredNode && (
        <NodeHoverCard node={hoveredNode} />
      )}

      {/* Floating Legend HUD */}
      <LegendHUD
        selectedKind={selectedKind}
        onSelectKind={setSelectedKind}
      />

      {/* Live Telemetry Stream Panel */}
      {isSimulating && (
        <LiveTelemetryPanel
          events={telemetryEvents}
          rps={rps}
          activeCount={activeEdgeIds.length}
        />
      )}

      {/* Sliding Node Inspector */}
      <NodeInspectorSheet
        node={selectedNode}
        status="idle"
        onClose={() => setSelectedNode(null)}
        onSelectNode={node => handleNodeClick(node)}
      />
    </div>
  );
}
