import { FC, memo, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

const MAX_LABELS = 600;
const DEFAULT_MAX_DISTANCE = 80;

function formatForceKn(force_kn: number): string {
  const abs = Math.abs(force_kn);
  if (abs >= 1000) return `${(force_kn / 1000).toFixed(2)} MN`;
  if (abs >= 1) return `${force_kn.toFixed(2)} kN`;
  return `${(force_kn * 1000).toFixed(0)} N`;
}

const NodeLabel: FC<{ id: string; x: number; y: number; z: number; maxDistance: number }> = memo(({ id, x, y, z, maxDistance }) => {
  const { camera } = useThree();
  const position = useMemo(() => new Vector3(x, y, z), [x, y, z]);
  const cameraDistance = camera.position.distanceTo(position);

  if (cameraDistance > maxDistance) return null;

  return (
    <Html position={[x, y, z]} center distanceFactor={11} zIndexRange={[120, 0]} occlude={false}>
      <div className="pointer-events-none select-none px-1 py-0.5 rounded bg-blue-500/85 text-white text-[10px] font-mono leading-none whitespace-nowrap shadow-sm">
        {id}
      </div>
    </Html>
  );
});
NodeLabel.displayName = 'NodeLabel';

const MemberLabel: FC<{
  id: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  maxDistance: number;
}> = memo(({ id, start, end, maxDistance }) => {
  const { camera } = useThree();
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const mz = (start.z + end.z) / 2;
  const position = useMemo(() => new Vector3(mx, my, mz), [mx, my, mz]);
  const cameraDistance = camera.position.distanceTo(position);

  if (cameraDistance > maxDistance) return null;

  return (
    <Html position={[mx, my, mz]} center distanceFactor={12} zIndexRange={[110, 0]} occlude={false}>
      <div className="pointer-events-none select-none px-1 py-0.5 rounded bg-amber-400/90 text-black text-[10px] font-mono leading-none whitespace-nowrap border border-amber-600/40 shadow-sm">
        {id}
      </div>
    </Html>
  );
});
MemberLabel.displayName = 'MemberLabel';

const LoadLabel: FC<{ id: string; x: number; y: number; z: number; magnitude: number; maxDistance: number }> = memo(({ id, x, y, z, magnitude, maxDistance }) => {
  const { camera } = useThree();
  const position = useMemo(() => new Vector3(x, y + 0.6, z), [x, y, z]);
  const cameraDistance = camera.position.distanceTo(position);

  if (cameraDistance > maxDistance) return null;

  return (
    <Html position={[x, y + 0.6, z]} center distanceFactor={11} zIndexRange={[115, 0]} occlude={false}>
      <div className="pointer-events-none select-none px-1 py-0.5 rounded bg-red-500/90 text-white text-[10px] font-mono leading-none whitespace-nowrap border border-red-700/40 shadow-sm">
        ↓ {id}: {formatForceKn(magnitude)}
      </div>
    </Html>
  );
});
LoadLabel.displayName = 'LoadLabel';

export const ModelLabelsOverlay: FC = memo(() => {
  const {
    showNodeLabels,
    showMemberLabels,
    showLoadLabels,
    nodes,
    members,
    loads,
  } = useModelStore(
    useShallow((state) => ({
      showNodeLabels: state.showNodeLabels,
      showMemberLabels: state.showMemberLabels,
      showLoadLabels: state.showLoadLabels,
      nodes: state.nodes,
      members: state.members,
      loads: state.loads,
    }))
  );

  const nodeList = useMemo(() => Array.from(nodes.values()), [nodes]);
  const memberList = useMemo(() => Array.from(members.values()), [members]);
  const pointLoads = useMemo(
    () =>
      loads
        .filter((l) => {
          const hasNode = Boolean(l.nodeId);
          const magnitude = Math.hypot(l.fx || 0, l.fy || 0, l.fz || 0);
          return hasNode && magnitude > 0;
        })
        .slice(0, MAX_LABELS),
    [loads]
  );

  if (!showNodeLabels && !showMemberLabels && !showLoadLabels) {
    return null;
  }

  return (
    <group name="model-label-overlays">
      {showNodeLabels &&
        nodeList.slice(0, MAX_LABELS).map((n) => (
          <NodeLabel
            key={`node-label-${n.id}`}
            id={n.id}
            x={n.x}
            y={n.y}
            z={n.z}
            maxDistance={DEFAULT_MAX_DISTANCE}
          />
        ))}

      {showMemberLabels &&
        memberList.slice(0, MAX_LABELS).map((m) => {
          const start = nodes.get(m.startNodeId);
          const end = nodes.get(m.endNodeId);
          if (!start || !end) return null;
          return (
            <MemberLabel
              key={`member-label-${m.id}`}
              id={m.id}
              start={start}
              end={end}
              maxDistance={DEFAULT_MAX_DISTANCE}
            />
          );
        })}

      {showLoadLabels &&
        pointLoads.map((l) => {
          const node = nodes.get(l.nodeId);
          if (!node) return null;
          const magnitude = Math.hypot(l.fx || 0, l.fy || 0, l.fz || 0);
          if (magnitude <= 0) return null;
          return (
            <LoadLabel
              key={`load-label-${l.id}`}
              id={l.id}
              x={node.x}
              y={node.y}
              z={node.z}
              magnitude={magnitude}
              maxDistance={DEFAULT_MAX_DISTANCE}
            />
          );
        })}
    </group>
  );
});

ModelLabelsOverlay.displayName = 'ModelLabelsOverlay';

export default ModelLabelsOverlay;
