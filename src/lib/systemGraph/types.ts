export type NodeStatus = 'idle' | 'processing' | 'success' | 'error';

/** Wire format from /api/ws/system-graph. Mirrored by the Go struct in handler/ws_system_graph.go — keep both in sync. */
export interface SystemEvent {
  id: string;
  timestamp: string; // ISO 8601
  edge_id: string;   // must match an ArchEdge.id from architecture.ts
  status: 'processing' | 'success' | 'error';
}
