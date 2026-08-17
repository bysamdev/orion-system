import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { GraphCanvasRef } from 'reagraph';
import { useSelection } from 'reagraph';
import { ARCH_NODES, ARCH_EDGES, NODE_BY_ID } from './architecture';
import type { ArchNode, NodeKind, NodeStatus, TrafficIntensity, LiveTelemetryEvent } from './types';
import { GraphCanvasView, type LayoutMode } from './components/GraphCanvasView';
import { HUDHeader } from './components/HUDHeader';
import { LegendHUD } from './components/LegendHUD';
import { NodeInspectorSheet } from './components/NodeInspectorSheet';
import { LiveTelemetryPanel } from './components/LiveTelemetryPanel';

const INTENSITY_CONFIG: Record<TrafficIntensity, { batchSize: number; intervalMs: number; speed: number }> = {
  low: { batchSize: 2, intervalMs: 2200, speed: 0.9 },
  normal: { batchSize: 4, intervalMs: 1400, speed: 1.4 },
  high: { batchSize: 7, intervalMs: 800, speed: 2.0 },
  warp: { batchSize: 12, intervalMs: 400, speed: 3.2 },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<NodeKind | 'all'>('all');
  const [isSimulating, setIsSimulating] = useState(true);
  const [trafficIntensity, setTrafficIntensity] = useState<TrafficIntensity>('normal');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('forceDirected3d');

  const [activeEdgeIds, setActiveEdgeIds] = useState<string[]>([]);
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({});
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

  // Enhanced Multi-Pulse Traffic Simulation Loop
  useEffect(() => {
    if (!isSimulating) {
      setActiveEdgeIds([]);
      setNodeStatus({});
      setRps(0);
      return;
    }

    const config = INTENSITY_CONFIG[trafficIntensity];
    const baseRps = trafficIntensity === 'warp' ? 84 : trafficIntensity === 'high' ? 38 : trafficIntensity === 'normal' ? 18 : 6;
    setRps(baseRps + Math.floor(Math.random() * 5));

    const interval = setInterval(() => {
      // Pick multiple random edges per cycle based on intensity
      const chosenEdges: typeof ARCH_EDGES = [];
      const shuffled = [...ARCH_EDGES].sort(() => 0.5 - Math.random());
      const count = Math.min(config.batchSize, shuffled.length);

      for (let i = 0; i < count; i++) {
        chosenEdges.push(shuffled[i]);
      }

      const newIds = chosenEdges.map(e => e.id);
      setActiveEdgeIds(prev => Array.from(new Set([...prev, ...newIds])));

      // Update Node Status
      setNodeStatus(prev => {
        const next = { ...prev };
        chosenEdges.forEach(e => {
          next[e.source] = 'processing';
          next[e.target] = 'processing';
        });
        return next;
      });

      // Generate Live Telemetry Events
      const newEvents: LiveTelemetryEvent[] = chosenEdges.map(edge => {
        const src = NODE_BY_ID.get(edge.source);
        const tgt = NODE_BY_ID.get(edge.target);
        const isDbOrAi = tgt?.kind === 'database' || tgt?.kind === 'ai';
        const isError = Math.random() < 0.03;

        return {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          edgeId: edge.id,
          sourceLabel: src?.label || edge.source,
          targetLabel: tgt?.label || edge.target,
          sourceKind: src?.kind || 'frontend',
          targetKind: tgt?.kind || 'backend',
          protocol: edge.protocol || 'HTTPS / REST',
          latencyMs: isDbOrAi ? Math.floor(Math.random() * 45) + 18 : Math.floor(Math.random() * 15) + 4,
          status: isError ? 'AI INFERENCE' : isDbOrAi ? 'CACHE HIT' : '200 OK',
        };
      });

      setTelemetryEvents(prev => [...newEvents, ...prev].slice(0, 50));

      // Resolve packet cycle
      const duration = (1200 / config.speed);
      setTimeout(() => {
        setActiveEdgeIds(prev => prev.filter(id => !newIds.includes(id)));

        setNodeStatus(prev => {
          const next = { ...prev };
          chosenEdges.forEach(e => {
            next[e.target] = Math.random() < 0.04 ? 'error' : 'success';
          });
          return next;
        });

        // Decay back to idle
        setTimeout(() => {
          setNodeStatus(prev => {
            const next = { ...prev };
            chosenEdges.forEach(e => {
              delete next[e.source];
              delete next[e.target];
            });
            return next;
          });
        }, 1800);
      }, duration);
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
    setPathFrom(null);
    setPathTo(null);
    clearSelections();
  }, [clearSelections]);

  const handleResetView = useCallback(() => {
    setSelectedNode(null);
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
        nodeStatus={nodeStatus}
        layoutMode={layoutMode}
        speedMultiplier={INTENSITY_CONFIG[trafficIntensity].speed}
        onNodeClick={handleNodeClick}
        onCanvasClick={handleCanvasClick}
      />

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
        status={selectedNode ? nodeStatus[selectedNode.id] : 'idle'}
        onClose={() => setSelectedNode(null)}
        onSelectNode={node => handleNodeClick(node)}
      />
    </div>
  );
}
