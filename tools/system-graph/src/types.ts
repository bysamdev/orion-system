export type NodeKind = 'frontend' | 'backend' | 'database' | 'service' | 'api' | 'ai';
export type NodeStatus = 'idle' | 'processing' | 'success' | 'error';

export interface ArchNode {
  id: string;
  label: string;
  kind: NodeKind;
  description: string;
  sourceRef: string;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface TrafficEvent {
  id: string;
  timestamp: string;
  edge_id: string;
  sourceNode: string;
  targetNode: string;
  status: NodeStatus;
}
