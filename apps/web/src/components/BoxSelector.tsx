import { FC, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useModelStore } from '../store/model';

export const BoxSelector: FC = () => {
    const { gl, camera } = useThree();
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const selectMultiple = useModelStore((state) => state.selectMultiple);

    // Keep stable refs to the latest store values so event handlers
    // never capture stale closures (avoids the re-attach treadmill).
    const nodesRef = useRef(nodes);
    const membersRef = useRef(members);
    const selectMultipleRef = useRef(selectMultiple);
    nodesRef.current = nodes;
    membersRef.current = members;
    selectMultipleRef.current = selectMultiple;

    // DOM overlay for the rubber-band rectangle
    const selectionBoxRef = useRef<HTMLDivElement | null>(null);

    // Mutable drag state — refs instead of useState so updates
    // don't trigger re-renders or re-run the effect.
    const isSelectingRef = useRef(false);
    const startPointRef  = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const canvas = gl.domElement;
        const parent = canvas.parentElement;
        if (!parent) return;

        // Create rubber-band selection box overlay (STAAD / SkyCiv style)
        const box = document.createElement('div');
        box.style.cssText = [
            'position:absolute',
            'border:1px solid #3b82f6',
            'background:rgba(0,170,255,0.12)',
            'pointer-events:none',
            'display:none',
            'z-index:1000',
        ].join(';');
        parent.appendChild(box);
        selectionBoxRef.current = box;

        // ── Pointer Down ──────────────────────────────────────────────────────
        const handlePointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) return;
            e.stopPropagation();

            const rect = parent.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            startPointRef.current   = { x, y };
            isSelectingRef.current  = true;

            box.style.display = 'block';
            box.style.left   = `${x}px`;
            box.style.top    = `${y}px`;
            box.style.width  = '0px';
            box.style.height = '0px';

            canvas.setPointerCapture(e.pointerId);
        };

        // ── Pointer Move ──────────────────────────────────────────────────────
        const handlePointerMove = (e: PointerEvent) => {
            if (!isSelectingRef.current || !startPointRef.current) return;
            e.preventDefault();

            const rect   = parent.getBoundingClientRect();
            const x      = e.clientX - rect.left;
            const y      = e.clientY - rect.top;
            const start  = startPointRef.current;

            const left   = Math.min(start.x, x);
            const top    = Math.min(start.y, y);
            const width  = Math.abs(x - start.x);
            const height = Math.abs(y - start.y);

            box.style.left   = `${left}px`;
            box.style.top    = `${top}px`;
            box.style.width  = `${width}px`;
            box.style.height = `${height}px`;
        };

        // ── Pointer Up ────────────────────────────────────────────────────────
        const handlePointerUp = (e: PointerEvent) => {
            if (!isSelectingRef.current || !startPointRef.current) return;

            canvas.releasePointerCapture(e.pointerId);

            box.style.display = 'none';
            isSelectingRef.current = false;

            const rect   = parent.getBoundingClientRect();
            const x      = e.clientX - rect.left;
            const y      = e.clientY - rect.top;
            const start  = startPointRef.current;
            startPointRef.current = null;

            const minX = Math.min(start.x, x);
            const maxX = Math.max(start.x, x);
            const minY = Math.min(start.y, y);
            const maxY = Math.max(start.y, y);

            // Ignore accidental micro-clicks (< 5 px drag)
            if (maxX - minX < 5 && maxY - minY < 5) return;

            const w = rect.width;
            const h = rect.height;
            const vec = new THREE.Vector3();
            const selected: string[] = [];

            // Project nodes from world → NDC → screen pixels
            nodesRef.current.forEach((node, nodeId) => {
                vec.set(node.x, node.y, node.z).project(camera);
                if (vec.z >= 1) return; // behind camera
                const sx = (vec.x + 1) / 2 * w;
                const sy = (1 - vec.y) / 2 * h; // Y inverted in CSS
                if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
                    selected.push(nodeId);
                }
            });

            // Include members whose midpoint falls inside the box (STAAD "window" select)
            membersRef.current.forEach((member, memberId) => {
                const s = nodesRef.current.get(member.startNodeId);
                const en = nodesRef.current.get(member.endNodeId);
                if (!s || !en) return;
                vec.set(
                    (s.x + en.x) / 2,
                    (s.y + en.y) / 2,
                    (s.z + en.z) / 2,
                ).project(camera);
                if (vec.z >= 1) return;
                const sx = (vec.x + 1) / 2 * w;
                const sy = (1 - vec.y) / 2 * h;
                if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
                    selected.push(memberId);
                }
            });

            if (selected.length > 0) {
                selectMultipleRef.current(selected);
            }
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup',   handlePointerUp);

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup',   handlePointerUp);
            box.remove();
            selectionBoxRef.current = null;
        };
    // Only re-run if the gl context or camera instance changes (i.e. canvas remount)
    // Store values are accessed via refs so they never force a re-attach.
    }, [gl, camera]); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
};
