import { FC, memo, useMemo } from 'react';
import { useModelStore } from '../store/model';
import { useShallow } from 'zustand/react/shallow';
import { NodesRenderer } from './NodesRenderer';
import { MembersRenderer } from './MembersRenderer';
import ModeShapeRenderer, { ModeShapeData } from './results/ModeShapeRenderer';

export const ModelRenderer: FC = memo(() => {
    const {
        modalResults, activeModeIndex, modeAmplitude,
        isAnimating, nodes, members,
    } = useModelStore(
        useShallow((state) => ({
            modalResults: state.modalResults,
            activeModeIndex: state.activeModeIndex,
            modeAmplitude: state.modeAmplitude,
            isAnimating: state.isAnimating,
            nodes: state.nodes,
            members: state.members,
        }))
    );

    const activeMode = useMemo(() => {
        if (!modalResults || activeModeIndex < 0 || activeModeIndex >= modalResults.modes.length) return null;
        return modalResults.modes[activeModeIndex];
    }, [modalResults, activeModeIndex]);

    const activeModeData = useMemo<ModeShapeData | null>(() => {
        if (!activeMode) return null;
        // Validate that shape is a proper Map before iterating
        if (!activeMode.shape || !(activeMode.shape instanceof Map)) {
            console.warn('[ModelRenderer] Invalid mode shape data - not a Map');
            return null;
        }
        const displacements = [];
        // Map<string, number[]> where [dx, dy, dz, rx, ry, rz]
        for (const [nodeId, disp] of activeMode.shape.entries()) {
            // Validate displacement array
            if (!Array.isArray(disp) || disp.length < 3) {
                console.warn(`[ModelRenderer] Invalid displacement for node ${nodeId}`);
                continue;
            }
            displacements.push({
                nodeId,
                dx: disp[0] ?? 0,
                dy: disp[1] ?? 0,
                dz: disp[2] ?? 0
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
});
