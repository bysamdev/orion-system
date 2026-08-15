import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Object3D, Scene } from 'three';
import { ARCH_EDGES } from '@/lib/systemGraph/architecture';

interface EdgeParticlesProps {
  activeEdgeIds: string[];
}

const EDGE_BY_ID = new Map(ARCH_EDGES.map(e => [e.id, e]));
const CYCLE_SECONDS = 1.2;

/**
 * Locate a node's rendered Object3D by scanning the scene for reagraph's own
 * node marker (`userData: { id, type: 'node' }`, see reagraph's Node
 * component in node_modules/reagraph/dist/index.js). This mirrors the
 * technique reagraph uses internally (see its `fitNodesInView`/lasso node
 * lookup) to read live positions.
 *
 * NOTE: this is a deliberate departure from the originally planned approach
 * of reading x/y/z off `GraphCanvasRef.getGraph().getNodeAttributes(id)`.
 * That graphology graph instance is rebuilt on every layout pass from the
 * raw input nodes (id/label/subLabel/fill/data only) and never receives the
 * computed layout positions — those live only in reagraph's internal
 * d3-force simulation state and the React-only `nodes` store, neither of
 * which is exposed via `GraphCanvasRef`. See task-14-report.md for details.
 */
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
  const meshRef = useRef<Mesh>(null);
  const edge = EDGE_BY_ID.get(edgeId);

  useFrame(({ clock, scene }) => {
    if (!meshRef.current || !edge) return;

    const from = findNodeObject3D(scene, edge.source);
    const to = findNodeObject3D(scene, edge.target);
    if (!from || !to) return;

    const t = (clock.getElapsedTime() % CYCLE_SECONDS) / CYCLE_SECONDS;
    meshRef.current.position.set(
      from.position.x + (to.position.x - from.position.x) * t,
      from.position.y + (to.position.y - from.position.y) * t,
      from.position.z + (to.position.z - from.position.z) * t
    );
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.2, 8, 8]} />
      <meshBasicMaterial color="#fbbf24" />
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
