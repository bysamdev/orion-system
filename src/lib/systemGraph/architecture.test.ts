import { describe, it, expect } from 'vitest';
import { ARCH_NODES, ARCH_EDGES } from './architecture';

describe('architecture catalog', () => {
  it('has between 35 and 46 nodes', () => {
    expect(ARCH_NODES.length).toBeGreaterThanOrEqual(35);
    expect(ARCH_NODES.length).toBeLessThanOrEqual(45);
  });

  it('has no duplicate node ids', () => {
    const ids = ARCH_NODES.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate edge ids', () => {
    const ids = ARCH_EDGES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every edge source and target references a real node id', () => {
    const nodeIds = new Set(ARCH_NODES.map(n => n.id));
    for (const edge of ARCH_EDGES) {
      expect(nodeIds.has(edge.source), `edge ${edge.id} source ${edge.source} missing`).toBe(true);
      expect(nodeIds.has(edge.target), `edge ${edge.id} target ${edge.target} missing`).toBe(true);
    }
  });

  it('every node has a non-empty description and every kind is one of the six allowed', () => {
    const allowed = new Set(['frontend', 'backend', 'database', 'service', 'api', 'ai']);
    for (const node of ARCH_NODES) {
      expect(node.description.length, `node ${node.id} has empty description`).toBeGreaterThan(0);
      expect(allowed.has(node.kind), `node ${node.id} has invalid kind ${node.kind}`).toBe(true);
    }
  });
});
