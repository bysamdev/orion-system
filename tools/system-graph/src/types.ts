export type NodeKind = 'frontend' | 'backend' | 'database' | 'service' | 'api' | 'ai';
export type NodeStatus = 'idle' | 'processing' | 'success' | 'error';
export type TrafficIntensity = 'low' | 'normal' | 'high' | 'warp';

export interface ArchNode {
  id: string;
  label: string;
  kind: NodeKind;
  description: string;
  sourceRef: string;
  tech: string;
  layer: string;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  protocol?: string;
}

export interface LiveTelemetryEvent {
  id: string;
  timestamp: string;
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  sourceKind: NodeKind;
  targetKind: NodeKind;
  protocol: string;
  latencyMs: number;
  status: '200 OK' | '201 CREATED' | 'STREAMING' | 'CACHE HIT' | 'AI INFERENCE';
}
