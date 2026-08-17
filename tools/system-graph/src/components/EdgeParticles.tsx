import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Scene, Object3D } from 'three';
import { EDGE_BY_ID, NODE_BY_ID, KIND_COLORS } from '../architecture';

interface EdgeParticlesProps {
  activeEdgeIds: string[];
  speedMultiplier?: number;
}

const BASE_CYCLE_SECONDS = 1.0;

function findNodeObject3D(scene: Scene, id: string): Object3D | undefined {
  let found: Object3D | undefined;
  scene.traverse(obj => {
    if (!found && obj.userData?.type === 'node' && obj.userData?.id === id) {
      found = obj;
    }
  });
  return found;
}

function StreamParticle({
  edgeId,
  offset = 0,
  scale = 1.0,
  opacity = 0.9,
  speedMultiplier = 1.0,
}: {
  edgeId: string;
  offset?: number;
  scale?: number;
  opacity?: number;
  speedMultiplier?: number;
}) {
  const coreRef = useRef<Mesh | null>(null);
  const auraRef = useRef<Mesh | null>(null);

  const edge = EDGE_BY_ID.get(edgeId);
  const sourceNode = edge ? NODE_BY_ID.get(edge.source) : null;
  const particleColor = sourceNode ? KIND_COLORS[sourceNode.kind] : '#38bdf8';

  useFrame(({ clock, scene }) => {
    if (!edge) return;

    const from = findNodeObject3D(scene, edge.source);
    const to = findNodeObject3D(scene, edge.target);
    if (!from || !to) return;

    const cycle = BASE_CYCLE_SECONDS / Math.max(0.2, speedMultiplier);
    const rawT = (clock.getElapsedTime() + offset) % cycle / cycle;
    // Linear progression 0 -> 1
    const t = rawT;

    const x = from.position.x + (to.position.x - from.position.x) * t;
    const y = from.position.y + (to.position.y - from.position.y) * t;
    const z = from.position.z + (to.position.z - from.position.z) * t;

    if (coreRef.current) {
      coreRef.current.position.set(x, y, z);
    }
    if (auraRef.current) {
      auraRef.current.position.set(x, y, z);
    }
  });

  return (
    <group>
      {/* Outer Glow Halo */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[3.2 * scale, 12, 12]} />
        <meshBasicMaterial
          color={particleColor}
          transparent={true}
          opacity={0.35 * opacity}
          depthWrite={false}
        />
      </mesh>

      {/* Bright Core Orb */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.8 * scale, 12, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent={true}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}

export function EdgeParticles({ activeEdgeIds, speedMultiplier = 1.0 }: EdgeParticlesProps) {
  return (
    <>
      {activeEdgeIds.map(edgeId => (
        <group key={edgeId}>
          {/* Main Lead Photon Orb */}
          <StreamParticle edgeId={edgeId} offset={0} scale={1.2} opacity={1.0} speedMultiplier={speedMultiplier} />
          {/* Trail Comet Particle 1 */}
          <StreamParticle edgeId={edgeId} offset={-0.12} scale={0.85} opacity={0.65} speedMultiplier={speedMultiplier} />
          {/* Trail Comet Particle 2 */}
          <StreamParticle edgeId={edgeId} offset={-0.24} scale={0.55} opacity={0.35} speedMultiplier={speedMultiplier} />
        </group>
      ))}
    </>
  );
}
