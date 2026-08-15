import { describe, it, expect, beforeEach } from 'vitest';
import { useSystemGraphStore } from './store';
import { ARCH_EDGES } from './architecture';

const sampleEdge = ARCH_EDGES[0]; // e-app-dashboard: fe-app -> fe-dashboard

function makeEvent(status: 'processing' | 'success' | 'error') {
  return {
    id: 'evt-1',
    timestamp: new Date().toISOString(),
    edge_id: sampleEdge.id,
    status,
  };
}

beforeEach(() => {
  useSystemGraphStore.getState().reset();
});

describe('useSystemGraphStore', () => {
  it('starts with every status idle and an empty log', () => {
    const { nodeStatus, activeEdgeIds, eventLog } = useSystemGraphStore.getState();
    expect(nodeStatus).toEqual({});
    expect(activeEdgeIds).toEqual([]);
    expect(eventLog).toEqual([]);
  });

  it('applying a processing event marks source and target as processing and activates the edge', () => {
    useSystemGraphStore.getState().applyEvent(makeEvent('processing'));
    const { nodeStatus, activeEdgeIds } = useSystemGraphStore.getState();
    expect(nodeStatus[sampleEdge.source]).toBe('processing');
    expect(nodeStatus[sampleEdge.target]).toBe('processing');
    expect(activeEdgeIds).toContain(sampleEdge.id);
  });

  it('applying a success event marks target as success and deactivates the edge', () => {
    useSystemGraphStore.getState().applyEvent(makeEvent('processing'));
    useSystemGraphStore.getState().applyEvent(makeEvent('success'));
    const { nodeStatus, activeEdgeIds } = useSystemGraphStore.getState();
    expect(nodeStatus[sampleEdge.target]).toBe('success');
    expect(activeEdgeIds).not.toContain(sampleEdge.id);
  });

  it('applying an error event marks target as error and deactivates the edge', () => {
    useSystemGraphStore.getState().applyEvent(makeEvent('processing'));
    useSystemGraphStore.getState().applyEvent(makeEvent('error'));
    const { nodeStatus, activeEdgeIds } = useSystemGraphStore.getState();
    expect(nodeStatus[sampleEdge.target]).toBe('error');
    expect(activeEdgeIds).not.toContain(sampleEdge.id);
  });

  it('appends every event to the log, newest first, capped at 50', () => {
    for (let i = 0; i < 55; i++) {
      useSystemGraphStore.getState().applyEvent({ ...makeEvent('success'), id: `evt-${i}` });
    }
    const { eventLog } = useSystemGraphStore.getState();
    expect(eventLog.length).toBe(50);
    expect(eventLog[0].id).toBe('evt-54');
  });

  it('ignores an event whose edge_id is not in the catalog', () => {
    useSystemGraphStore.getState().applyEvent({ id: 'x', timestamp: new Date().toISOString(), edge_id: 'does-not-exist', status: 'processing' });
    const { nodeStatus, eventLog } = useSystemGraphStore.getState();
    expect(nodeStatus).toEqual({});
    expect(eventLog).toEqual([]);
  });
});
