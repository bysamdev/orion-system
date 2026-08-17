import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { GraphCanvasRef } from 'reagraph';
import { useSelection } from 'reagraph';
import { ARCH_NODES, ARCH_EDGES, NODE_BY_ID } from './architecture';
import type { ArchNode, NodeKind, NodeStatus } from './types';
import { GraphCanvasView } from './components/GraphCanvasView';
import { HUDHeader } from './components/HUDHeader';
import { LegendHUD } from './components/LegendHUD';
import { NodeInspectorSheet } from './components/NodeInspectorSheet';

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
  const [activeEdgeIds, setActiveEdgeIds] = useState<string[]>([]);
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>({});
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
        node.description.toLowerCase().includes(query);
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

  // Self-contained live traffic simulation loop
  useEffect(() => {
    if (!isSimulating) {
      setActiveEdgeIds([]);
      setNodeStatus({});
      return;
    }

    const interval = setInterval(() => {
      // Pick 1-2 random edges to pulse
      const sampleEdge = ARCH_EDGES[Math.floor(Math.random() * ARCH_EDGES.length)];
      if (!sampleEdge) return;

      setActiveEdgeIds(prev => Array.from(new Set([...prev, sampleEdge.id])));
      setNodeStatus(prev => ({
        ...prev,
        [sampleEdge.source]: 'processing',
        [sampleEdge.target]: 'processing',
      }));

      // Complete pulse after 1.8s
      setTimeout(() => {
        setActiveEdgeIds(prev => prev.filter(id => id !== sampleEdge.id));
        setNodeStatus(prev => ({
          ...prev,
          [sampleEdge.target]: Math.random() < 0.05 ? 'error' : 'success',
        }));

        // Fade back to idle after 3s
        setTimeout(() => {
          setNodeStatus(prev => {
            const next = { ...prev };
            delete next[sampleEdge.source];
            delete next[sampleEdge.target];
            return next;
          });
        }, 3000);
      }, 1800);
    }, 2200);

    return () => clearInterval(interval);
  }, [isSimulating]);

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
  }, [clearSelections]);

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
        onResetView={handleResetView}
      />

      {/* Pathfinding HUD (if path selected) */}
      {pathFrom && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-indigo-400">Rota:</span>
            <span className="text-white font-medium bg-slate-800 px-2 py-0.5 rounded-lg border border-white/5">
              {pathFrom.label}
            </span>
            <span className="text-slate-500">➔</span>
            {pathTo ? (
              <span className="text-white font-medium bg-slate-800 px-2 py-0.5 rounded-lg border border-white/5">
                {pathTo.label}
              </span>
            ) : (
              <span className="text-slate-400 italic">Clique no 2º nó de destino...</span>
            )}
          </div>
          <button
            onClick={() => {
              setPathFrom(null);
              setPathTo(null);
              clearSelections();
            }}
            className="text-xs text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-all"
          >
            Limpar
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
        onNodeClick={handleNodeClick}
        onCanvasClick={handleCanvasClick}
      />

      {/* Floating Legend HUD */}
      <LegendHUD
        selectedKind={selectedKind}
        onSelectKind={setSelectedKind}
      />

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
