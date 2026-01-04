import { FC, useMemo } from 'react';
import { useModelStore } from '../store/model';
import { NodesRenderer } from './NodesRenderer';
import { MembersRenderer } from './MembersRenderer';
import ModeShapeRenderer, { ModeShapeData } from './results/ModeShapeRenderer';

export const ModelRenderer: FC = () => {
    const modalResults = useModelStore(s => s.modalResults);
    const activeModeIndex = useModelStore(s => s.activeModeIndex);
    const modeAmplitude = useModelStore(s => s.modeAmplitude);
    const isAnimating = useModelStore(s => s.isAnimating);
    const nodes = useModelStore(s => s.nodes);
    const members = useModelStore(s => s.members);

    const activeMode = useMemo(() => {
        if (!modalResults || activeModeIndex < 0 || activeModeIndex >= modalResults.modes.length) return null;
        return modalResults.modes[activeModeIndex];
    }, [modalResults, activeModeIndex]);

    const activeModeData = useMemo<ModeShapeData | null>(() => {
        if (!activeMode) return null;
        const displacements = [];
        // Map<string, number[]> where [dx, dy, dz, rx, ry, rz]
        for (const [nodeId, disp] of activeMode.shape.entries()) {
            displacements.push({
                nodeId,
                dx: disp[0],
                dy: disp[1],
                dz: disp[2]
            });
        }
        return {
            modeNumber: activeMode.modeNumber,
            frequency: activeMode.frequency,
            displacements
        };
    }, [activeMode]);

    const nodesList = useMemo(() => Array.from(nodes.values()), [nodes]);
    const membersList = useMemo(() => Array.from(members.values()), [members]);

    if (activeModeData) {
        return (
            <ModeShapeRenderer
                nodes={nodesList}
                members={membersList}
                modeShape={activeModeData}
                scale={modeAmplitude}
                animate={isAnimating}
                showOriginal={true}
            />
        );
    }

    return (
        <group>
            <NodesRenderer />
            <MembersRenderer />
        </group>
    );
};
