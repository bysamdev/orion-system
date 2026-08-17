import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { SphereGeometry, MeshBasicMaterial, type Mesh, type Scene, type Object3D, type Group } from 'three';
import { EDGE_BY_ID, NODE_BY_ID, KIND_COLORS } from '../architecture';
import type { NodeKind } from '../types';

interface EdgeParticlesProps {
  activeEdgeIds: string[];
  speedMultiplier?: number;
}

const BASE_CYCLE_SECONDS = 1.3;

// Shared singleton low-poly geometries - larger and highly visible
const SHARED_CORE_GEO = new SphereGeometry(2.5, 10, 10);
const SHARED_AURA_GEO = new SphereGeometry(5.5, 10, 10);

// Cached materials by kind color with enhanced opacity and brightness
const CORE_MATERIAL = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1.0 });
const AURA_MATERIALS: Record<NodeKind, MeshBasicMaterial> = {
  frontend: new MeshBasicMaterial({ color: KIND_COLORS.frontend, transparent: true, opacity: 0.5, depthWrite: false }),
  backend: new MeshBasicMaterial({ color: KIND_COLORS.backend, transparent: true, opacity: 0.5, depthWrite: false }),
  database: new MeshBasicMaterial({ color: KIND_COLORS.database, transparent: true, opacity: 0.5, depthWrite: false }),
  service: new MeshBasicMaterial({ color: KIND_COLORS.service, transparent: true, opacity: 0.5, depthWrite: false }),
  api: new MeshBasicMaterial({ color: KIND_COLORS.api, transparent: true, opacity: 0.5, depthWrite: false }),
  ai: new MeshBasicMaterial({ color: KIND_COLORS.ai, transparent: true, opacity: 0.5, depthWrite: false }),
};

function StreamParticle({
  edgeId,
  offset = 0,
  scale = 1.0,
  speedMultiplier = 1.0,
  nodeMapRef,
}: {
  edgeId: string;
  offset?: number;
  scale?: number;
  speedMultiplier?: number;
  nodeMapRef: React.MutableRefObject<Map<string, Object3D>>;
}) {
  const groupRef = useRef<Group | null>(null);

  const edge = EDGE_BY_ID.get(edgeId);
  const sourceNode = edge ? NODE_BY_ID.get(edge.source) : null;
  const auraMat = sourceNode ? AURA_MATERIALS[sourceNode.kind] || AURA_MATERIALS.frontend : AURA_MATERIALS.frontend;

  useFrame(({ clock }) => {
    if (!edge || !groupRef.current) return;

    // Fast O(1) cache lookup - zero CPU waste!
    const from = nodeMapRef.current.get(edge.source);
    const to = nodeMapRef.current.get(edge.target);
    if (!from || !to) return;

    const cycle = BASE_CYCLE_SECONDS / Math.max(0.2, speedMultiplier);
    const rawT = (clock.getElapsedTime() + offset) % cycle / cycle;
    const t = rawT < 0 ? rawT + 1 : rawT;

    groupRef.current.position.set(
      from.position.x + (to.position.x - from.position.x) * t,
      from.position.y + (to.position.y - from.position.y) * t,
      from.position.z + (to.position.z - from.position.z) * t,
    );
  });

  return (
    <group ref={groupRef} scale={scale}>
      {/* Radiant Glowing Aura */}
      <mesh geometry={SHARED_AURA_GEO} material={auraMat} />
      {/* High-Intensity Core Photon */}
      <mesh geometry={SHARED_CORE_GEO} material={CORE_MATERIAL} />
    </group>
  );
}

export function EdgeParticles({ activeEdgeIds, speedMultiplier = 1.0 }: EdgeParticlesProps) {
  const nodeMapRef = useRef<Map<string, Object3D>>(new Map());
  const frameCountRef = useRef(0);

  useFrame(({ scene }) => {
    frameCountRef.current++;
    if (frameCountRef.current % 3 === 0 || nodeMapRef.current.size === 0) {
      const map = new Map<string, Object3D>();
      scene.traverse(obj => {
        if (obj.userData?.type === 'node' && obj.userData?.id) {
          map.set(obj.userData.id, obj);
        }
      });
      nodeMapRef.current = map;
    }
  });

  return (
    <>
      {activeEdgeIds.map(edgeId => (
        <group key={edgeId}>
          {/* Main Massive Photon */}
          <StreamParticle edgeId={edgeId} offset={0} scale={1.2} speedMultiplier={speedMultiplier} nodeMapRef={nodeMapRef} />
          {/* Trailing Comet Photon 1 */}
          <StreamParticle edgeId={edgeId} offset={-0.12} scale={0.85} speedMultiplier={speedMultiplier} nodeMapRef={nodeMapRef} />
          {/* Trailing Comet Photon 2 */}
          <StreamParticle edgeId={edgeId} offset={-0.24} scale={0.55} speedMultiplier={speedMultiplier} nodeMapRef={nodeMapRef} />
        </group>
      ))}
    </>
  );
}
