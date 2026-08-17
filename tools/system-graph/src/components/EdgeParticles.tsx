import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Scene, Object3D } from 'three';
import { EDGE_BY_ID } from '../architecture';

interface EdgeParticlesProps {
  activeEdgeIds: string[];
}

const CYCLE_SECONDS = 1.2;

function findNodeObject3D(scene: Scene, id: string): Object3D | undefined {
  let found: Object3D | undefined;
  scene.traverse(obj => {
    if (!found && obj.userData?.type === 'node' && obj.userData?.id === id) {
      found = obj;
    }
  });
  return found;
}

function Particle({ edgeId }: { edgeId: string }) {
  const meshRef = useRef<Mesh | null>(null);

  useFrame(({ clock, scene }) => {
    if (!meshRef.current) return;
    const edge = EDGE_BY_ID.get(edgeId);
    if (!edge) return;

    const from = findNodeObject3D(scene, edge.source);
    const to = findNodeObject3D(scene, edge.target);
    if (!from || !to) return;

    const t = (clock.getElapsedTime() % CYCLE_SECONDS) / CYCLE_SECONDS;
    meshRef.current.position.set(
      from.position.x + (to.position.x - from.position.x) * t,
      from.position.y + (to.position.y - from.position.y) * t,
      from.position.z + (to.position.z - from.position.z) * t,
    );
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.4, 12, 12]} />
      <meshBasicMaterial color="#38bdf8" />
    </mesh>
  );
}

export function EdgeParticles({ activeEdgeIds }: EdgeParticlesProps) {
  return (
    <>
      {activeEdgeIds.map(edgeId => (
        <Particle key={edgeId} edgeId={edgeId} />
      ))}
    </>
  );
}
