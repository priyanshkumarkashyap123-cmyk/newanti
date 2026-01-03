import { FC, useState, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useModelStore } from '../store/model';

export const BoxSelector: FC = () => {
    const { gl, camera, scene } = useThree();
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const selectMultiple = useModelStore((state) => state.selectMultiple);

    // State
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
    const [currentPoint, setCurrentPoint] = useState<{ x: number, y: number } | null>(null);

    // Refs for optimization
    const selectionBoxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const canvas = gl.domElement;
        const parent = canvas.parentElement;

        if (!parent) return;

        // Create selection box element
        const box = document.createElement('div');
        box.style.position = 'absolute';
        box.style.border = '1px solid #00aaff';
        box.style.backgroundColor = 'rgba(0, 170, 255, 0.2)';
        box.style.pointerEvents = 'none';
        box.style.display = 'none';
        box.style.zIndex = '1000';
        parent.appendChild(box);
        selectionBoxRef.current = box;

        // Handlers
        const handlePointerDown = (e: PointerEvent) => {
            // Only start if Shift is held (standard multi-select) or we can make it default for a specific tool
            // For now, let's stick to Shift+Drag or Ctrl+Drag to avoid conflict with OrbitControls
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) return;

            // Or if middle/right mouse, ignore
            if (e.button !== 0) return;

            e.stopPropagation(); // Stop orbit controls if possible (might not work if orbit controls captures before)

            // We need to calculate position relative to the PARENT container of the canvas (which handles the View)
            // But gl.domElement might be the whole canvas covering all Views. 
            // In ViewportManager, we have <View>s. This BoxSelector needs to be instanced per View ideally. 
            // However, useThree gives us the state for the SPECIFIC View we are in.

            // Coordinates relative to the canvas/container
            const rect = parent.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            setStartPoint({ x, y });
            setCurrentPoint({ x, y });
            setIsSelecting(true);

            // Show box
            box.style.display = 'block';
            box.style.left = `${x}px`;
            box.style.top = `${y}px`;
            box.style.width = '0px';
            box.style.height = '0px';

            // Capture pointer needed?
            canvas.setPointerCapture(e.pointerId);
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isSelecting || !startPoint) return;

            e.preventDefault(); // Prevent scrolling/selection

            const rect = parent.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            setCurrentPoint({ x, y });

            // Update box style
            const left = Math.min(startPoint.x, x);
            const top = Math.min(startPoint.y, y);
            const width = Math.abs(x - startPoint.x);
            const height = Math.abs(y - startPoint.y);

            if (selectionBoxRef.current) {
                selectionBoxRef.current.style.left = `${left}px`;
                selectionBoxRef.current.style.top = `${top}px`;
                selectionBoxRef.current.style.width = `${width}px`;
                selectionBoxRef.current.style.height = `${height}px`;
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (!isSelecting || !startPoint || !currentPoint) return;

            canvas.releasePointerCapture(e.pointerId);
            setIsSelecting(false);

            if (selectionBoxRef.current) {
                selectionBoxRef.current.style.display = 'none';
            }

            // Perform Selection Logic
            const rect = parent.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Define selection bounds
            const minX = Math.min(startPoint.x, x);
            const maxX = Math.max(startPoint.x, x);
            const minY = Math.min(startPoint.y, y);
            const maxY = Math.max(startPoint.y, y);

            // Avoid accidental clicks (very small box) triggers
            if (maxX - minX < 5 && maxY - minY < 5) return;

            const selectedParams: string[] = [];

            // Project allNodes to screen
            // Since we are in a View, 'camera' is the view's camera
            // and 'glSize' is correctly handled by Drei's View?
            // Actually, we need to map World -> NDC -> Screen

            // Note: In Drei View, the viewport matches the HTML element size roughly

            nodes.forEach((node, nodeId) => {
                const vec = new THREE.Vector3(node.x, node.y, node.z);

                // Project to NDC (-1 to +1)
                vec.project(camera);

                // Convert NDC to pixel coordinates relative to the PARENT container
                // We need the width/height of the container
                const w = rect.width;
                const h = rect.height;

                const screenX = (vec.x + 1) / 2 * w;
                const screenY = -(vec.y - 1) / 2 * h; // Y is inverted in CSS

                // Check if inside box
                // Check depth (must be visible, z < 1)
                if (vec.z < 1 &&
                    screenX >= minX && screenX <= maxX &&
                    screenY >= minY && screenY <= maxY) {
                    selectedParams.push(nodeId);
                }
            });

            // Also select Members whose centroids or nodes are inside? (Staad style usually is 'Touched' or 'Inside')
            // Let's go with: Select members if both nodes are selected (Conservative) 
            // OR checks member centroid. 
            // Let's include members if their MIDPOINT is inside, to be more generous.

            members.forEach((member, memberId) => {
                const start = nodes.get(member.startNodeId);
                const end = nodes.get(member.endNodeId);
                if (start && end) {
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    const midZ = (start.z + end.z) / 2;

                    const vec = new THREE.Vector3(midX, midY, midZ);
                    vec.project(camera);

                    const w = rect.width;
                    const h = rect.height;
                    const screenX = (vec.x + 1) / 2 * w;
                    const screenY = -(vec.y - 1) / 2 * h;

                    if (vec.z < 1 &&
                        screenX >= minX && screenX <= maxX &&
                        screenY >= minY && screenY <= maxY) {
                        selectedParams.push(memberId);
                    }
                }
            });

            if (selectedParams.length > 0) {
                // If Shift/Ctrl held, Add to selection?
                // The prompt says "select multiple elements". Usually implies adding to selection or new selection.
                // We used Shift to trigger this, so we should probable Add.
                // But selectMultiple(ids) replaces? No, let's check store.
                // model.ts: selectMultiple = (ids) => set(s => { const new = new Set(s); ids.forEach... return new; })
                // It ADDS. Good.
                selectMultiple(selectedParams);
            }
        };

        // Attach to parent (because box is overlaid on parent)
        // Or attach to canvas?
        // Note: 'canvas' receives events.
        canvas.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            if (selectionBoxRef.current) {
                selectionBoxRef.current.remove();
            }
        };

    }, [gl, camera, nodes, members, selectMultiple, isSelecting, startPoint, currentPoint]); // Dependencies

    return null;
};
