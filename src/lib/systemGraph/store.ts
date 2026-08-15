import { create } from 'zustand';
import { ARCH_EDGES } from './architecture';
import type { SystemEvent, NodeStatus } from './types';

const EDGE_BY_ID = new Map(ARCH_EDGES.map(e => [e.id, e]));
const EVENT_LOG_LIMIT = 50;

interface SystemGraphState {
  nodeStatus: Record<string, NodeStatus>;
  activeEdgeIds: string[];
  eventLog: SystemEvent[];
  applyEvent: (event: SystemEvent) => void;
  reset: () => void;
}

export const useSystemGraphStore = create<SystemGraphState>((set, get) => ({
  nodeStatus: {},
  activeEdgeIds: [],
  eventLog: [],

  applyEvent: (event: SystemEvent) => {
    const edge = EDGE_BY_ID.get(event.edge_id);
    if (!edge) return; // unknown edge_id — ignore rather than crash on a bad/future payload

    const { nodeStatus, activeEdgeIds, eventLog } = get();

    const nextNodeStatus = { ...nodeStatus };
    if (event.status === 'processing') {
      nextNodeStatus[edge.source] = 'processing';
      nextNodeStatus[edge.target] = 'processing';
    } else {
      nextNodeStatus[edge.target] = event.status;
    }

    const nextActiveEdgeIds = event.status === 'processing'
      ? Array.from(new Set([...activeEdgeIds, edge.id]))
      : activeEdgeIds.filter(id => id !== edge.id);

    const nextEventLog = [event, ...eventLog].slice(0, EVENT_LOG_LIMIT);

    set({ nodeStatus: nextNodeStatus, activeEdgeIds: nextActiveEdgeIds, eventLog: nextEventLog });
  },

  reset: () => set({ nodeStatus: {}, activeEdgeIds: [], eventLog: [] }),
}));
