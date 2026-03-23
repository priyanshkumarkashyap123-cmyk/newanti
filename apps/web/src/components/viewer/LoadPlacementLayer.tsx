/**
 * LoadPlacementLayer.tsx - Interactive Load Placement on Members
 * 
 * Features:
 * - Hover detection on members with visual highlight
 * - Click to select member for load application
 * - Drag along member to set load position/length
 * - Visual preview of load (arrows for point loads, distributed arrows for UDL)
 * - Integration with LoadInputDialog for magnitude input
 */

import { FC, useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { Line, Cone, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore, Member, Node, MemberLoad } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';

// ============================================
// TYPES
// ============================================

interface LoadPlacement {
    memberId: string;
    startRatio: number;  // 0-1 position along member
    endRatio: number;    // 0-1 position along member
    type: 'UDL' | 'point';
}

interface MemberGeometry {
    id: string;
    start: THREE.Vector3;
    end: THREE.Vector3;
    direction: THREE.Vector3;
    length: number;
}

// ============================================
// CONSTANTS
// ============================================

const HOVER_COLOR = '#ff6b00';
const SELECTED_COLOR = '#ff00ff';
const LOAD_PREVIEW_COLOR = '#ff4444';
const MEMBER_DETECTION_RADIUS = 0.15; // How close mouse needs to be to member
const ARROW_SPACING = 0.5; // Spacing between UDL arrows in meters

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate closest point on a line segment to a given point
 * Returns the ratio (0-1) along the segment
 */
const getClosestPointOnSegment = (
    point: THREE.Vector3,
    lineStart: THREE.Vector3,
    lineEnd: THREE.Vector3
): { ratio: number; distance: number; closestPoint: THREE.Vector3 } => {
    const line = new THREE.Vector3().subVectors(lineEnd, lineStart);
    const lineLength = line.length();
    
    if (lineLength === 0) {
        return { ratio: 0, distance: point.distanceTo(lineStart), closestPoint: lineStart.clone() };
    }
    
    const lineDir = line.clone().normalize();
    const pointToStart = new THREE.Vector3().subVectors(point, lineStart);
    
    let t = pointToStart.dot(lineDir) / lineLength;
    t = Math.max(0, Math.min(1, t)); // Clamp to segment
    
    const closestPoint = new THREE.Vector3()
        .copy(lineStart)
        .add(lineDir.multiplyScalar(t * lineLength));
    
    return {
        ratio: t,
        distance: point.distanceTo(closestPoint),
        closestPoint
    };
};

// ============================================
// LOAD ARROW COMPONENT (Single downward arrow)
// ============================================

interface LoadArrowProps {
    position: THREE.Vector3;
    scale?: number;
    color?: string;
}

const LoadArrow: FC<LoadArrowProps> = ({ position, scale = 1, color = LOAD_PREVIEW_COLOR }) => {
    const arrowLength = 0.4 * scale;
    
    return (
        <group position={position}>
            {/* Shaft */}
            <Line
                points={[
                    new THREE.Vector3(0, arrowLength, 0),
                    new THREE.Vector3(0, 0.05, 0)
                ]}
                color={color}
                lineWidth={2}
            />
            {/* Arrowhead */}
            <Cone
                args={[0.04 * scale, 0.1 * scale, 8]}
                position={[0, 0.02, 0]}
                rotation={[Math.PI, 0, 0]}
            >
                <meshStandardMaterial color={color} />
            </Cone>
        </group>
    );
};

// ============================================
// UDL PREVIEW COMPONENT
// ============================================

interface UDLPreviewProps {
    start: THREE.Vector3;
    end: THREE.Vector3;
    magnitude?: number;
    color?: string;
}

const UDLPreview: FC<UDLPreviewProps> = ({ start, end, magnitude = 10, color = LOAD_PREVIEW_COLOR }) => {
    const arrows = useMemo(() => {
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const numArrows = Math.max(2, Math.floor(length / ARROW_SPACING) + 1);
        
        const arrowPositions: THREE.Vector3[] = [];
        for (let i = 0; i < numArrows; i++) {
            const t = i / (numArrows - 1);
            const pos = new THREE.Vector3().lerpVectors(start, end, t);
            pos.y += 0.5; // Offset above member
            arrowPositions.push(pos);
        }
        
        return arrowPositions;
    }, [start, end]);

    // Top connecting line
    const topLinePoints = useMemo(() => {
        return [
            new THREE.Vector3(start.x, start.y + 0.5 + 0.4, start.z),
            new THREE.Vector3(end.x, end.y + 0.5 + 0.4, end.z)
        ];
    }, [start, end]);

    return (
        <group>
            {/* Top connecting line */}
            <Line
                points={topLinePoints}
                color={color}
                lineWidth={2}
            />
            
            {/* Arrows */}
            {arrows.map((pos, i) => (
                <LoadArrow key={i} position={pos} color={color} />
            ))}
            
            {/* Magnitude label */}
            <Html
                position={[
                    (start.x + end.x) / 2,
                    start.y + 1.1,
                    (start.z + end.z) / 2
                ]}
                center
            >
                <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg">
                    {magnitude} kN/m
                </div>
            </Html>
        </group>
    );
};

// ============================================
// POINT LOAD PREVIEW COMPONENT
// ============================================

interface PointLoadPreviewProps {
    position: THREE.Vector3;
    magnitude?: number;
    color?: string;
}

const PointLoadPreview: FC<PointLoadPreviewProps> = ({ position, magnitude = 10, color = LOAD_PREVIEW_COLOR }) => {
    const arrowPos = useMemo(() => {
        return new THREE.Vector3(position.x, position.y + 0.5, position.z);
    }, [position]);

    return (
        <group>
            <LoadArrow position={arrowPos} scale={1.5} color={color} />
            
            {/* Magnitude label */}
            <Html
                position={[position.x, position.y + 1.2, position.z]}
                center
            >
                <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg">
                    {magnitude} kN
                </div>
            </Html>
        </group>
    );
};

// ============================================
// MEMBER HIGHLIGHT COMPONENT
// ============================================

interface MemberHighlightProps {
    start: THREE.Vector3;
    end: THREE.Vector3;
    color: string;
    isHovered?: boolean;
}

const MemberHighlight: FC<MemberHighlightProps> = ({ start, end, color, isHovered }) => {
    const lineRef = useRef<any>(null);
    
    useFrame(() => {
        if (isHovered && lineRef.current) {
            const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.15;
            // Directly mutate line width - avoid setState in useFrame
            if (lineRef.current.material) {
                lineRef.current.material.linewidth = 6 * pulse;
            }
        }
    });

    return (
        <Line
            ref={lineRef}
            points={[start, end]}
            color={color}
            lineWidth={isHovered ? 6 : 4}
            transparent
            opacity={0.8}
        />
    );
};

// ============================================
// MAIN LOAD PLACEMENT LAYER
// ============================================

interface LoadPlacementLayerProps {
    enabled?: boolean;
    onMemberSelected?: (memberId: string, position: number) => void;
    previewMagnitude?: number;
    loadType?: 'UDL' | 'point';
}

export const LoadPlacementLayer: FC<LoadPlacementLayerProps> = memo(({
    enabled = true,
    onMemberSelected,
    previewMagnitude = 10,
    loadType = 'UDL'
}) => {
    // ---- Store (useShallow prevents re-renders from unrelated state changes) ----
    const { nodes, members, activeTool, selectedIds } = useModelStore(
        useShallow((s) => ({
            nodes: s.nodes,
            members: s.members,
            activeTool: s.activeTool,
            selectedIds: s.selectedIds,
        }))
    );
    const setTool = useModelStore((s) => s.setTool);
    const select = useModelStore((s) => s.select);
    const addMemberLoad = useModelStore((s) => s.addMemberLoad);

    // ---- State ----
    const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
    const [cursorRatio, setCursorRatio] = useState<number>(0.5);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<number>(0);
    const [dragEnd, setDragEnd] = useState<number>(1);
    const [showPreview, setShowPreview] = useState(false);

    // ---- Three.js ----
    const { camera, raycaster, pointer, gl } = useThree();
    const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

    // ---- Check if load tool is active ----
    const isLoadToolActive = enabled && activeTool === 'memberLoad';

    // ---- Build member geometries ----
    const memberGeometries = useMemo((): MemberGeometry[] => {
        const geoms: MemberGeometry[] = [];
        
        members.forEach((member) => {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            
            if (startNode && endNode) {
                const start = new THREE.Vector3(startNode.x, startNode.y, startNode.z);
                const end = new THREE.Vector3(endNode.x, endNode.y, endNode.z);
                const direction = new THREE.Vector3().subVectors(end, start).normalize();
                const length = start.distanceTo(end);
                
                geoms.push({
                    id: member.id,
                    start,
                    end,
                    direction,
                    length
                });
            }
        });
        
        return geoms;
    }, [members, nodes]);

    // Pre-allocated scratch vector for raycasting (avoids GC at 60fps)
    const _planeIntersection = useRef(new THREE.Vector3());

    // ---- Find member under cursor ----
    const findMemberUnderCursor = useCallback((): { memberId: string; ratio: number } | null => {
        raycaster.setFromCamera(pointer, camera);
        
        // Get ray intersection with ground plane (approximate)
        raycaster.ray.intersectPlane(groundPlane, _planeIntersection.current);
        
        let closestMember: string | null = null;
        let closestDistance = MEMBER_DETECTION_RADIUS;
        let closestRatio = 0.5;
        
        for (const geom of memberGeometries) {
            const result = getClosestPointOnSegment(_planeIntersection.current, geom.start, geom.end);
            
            // Check distance in XZ plane (ignore Y for easier selection)
            const xzDistance = Math.sqrt(
                Math.pow(_planeIntersection.current.x - result.closestPoint.x, 2) +
                Math.pow(_planeIntersection.current.z - result.closestPoint.z, 2)
            );
            
            if (xzDistance < closestDistance) {
                closestDistance = xzDistance;
                closestMember = geom.id;
                closestRatio = result.ratio;
            }
        }
        
        return closestMember ? { memberId: closestMember, ratio: closestRatio } : null;
    }, [raycaster, pointer, camera, groundPlane, memberGeometries]);

    // ---- Update on frame ----
    // Use refs to avoid unnecessary state updates that cause re-renders
    const hoveredMemberIdRef = useRef<string | null>(null);
    const cursorRatioRef = useRef<number>(0.5);
    const showPreviewRef = useRef<boolean>(false);
    const dragEndRef = useRef<number>(1);
    
    useFrame(() => {
        if (!isLoadToolActive) return;
        
        const result = findMemberUnderCursor();
        
        if (result) {
            // Only update state if values actually changed
            if (hoveredMemberIdRef.current !== result.memberId) {
                hoveredMemberIdRef.current = result.memberId;
                setHoveredMemberId(result.memberId);
            }
            if (Math.abs(cursorRatioRef.current - result.ratio) > 0.01) {
                cursorRatioRef.current = result.ratio;
                setCursorRatio(result.ratio);
            }
            if (!showPreviewRef.current) {
                showPreviewRef.current = true;
                setShowPreview(true);
            }
            
            // Only update dragEnd if value actually changed (avoid re-renders every frame)
            if (isDragging && Math.abs(dragEndRef.current - result.ratio) > 0.01) {
                dragEndRef.current = result.ratio;
                setDragEnd(result.ratio);
            }
        } else {
            if (!isDragging) {
                if (hoveredMemberIdRef.current !== null) {
                    hoveredMemberIdRef.current = null;
                    setHoveredMemberId(null);
                }
                if (showPreviewRef.current) {
                    showPreviewRef.current = false;
                    setShowPreview(false);
                }
            }
        }
    });

    // ---- Handle pointer events ----
    useEffect(() => {
        if (!isLoadToolActive) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (hoveredMemberId) {
                setIsDragging(true);
                setDragStart(cursorRatio);
                setDragEnd(cursorRatio);
                dragEndRef.current = cursorRatio; // Reset ref when starting drag
                gl.domElement.style.cursor = 'grabbing';
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (isDragging && hoveredMemberId) {
                // Complete the load placement
                const startPos = Math.min(dragStart, dragEnd);
                const endPos = Math.max(dragStart, dragEnd);
                
                // If nearly the same point, treat as point load
                const isPointLoad = Math.abs(endPos - startPos) < 0.05;
                
                if (isPointLoad) {
                    // Apply point load at this position
                    addMemberLoad({
                        id: `ML${Date.now()}`,
                        memberId: hoveredMemberId,
                        type: 'point',
                        // Store in kN to match store/modelTypes (negative = downward)
                        P: -previewMagnitude,
                        a: (startPos + endPos) / 2,
                        direction: 'global_y'
                    });
                } else {
                    // Apply UDL over the dragged length
                    addMemberLoad({
                        id: `ML${Date.now()}`,
                        memberId: hoveredMemberId,
                        type: 'UDL',
                        // Store intensities in kN/m (negative = downward)
                        w1: -previewMagnitude,
                        w2: -previewMagnitude,
                        startPos,
                        endPos,
                        direction: 'global_y'
                    });
                }
                
                // Switch to select tool after applying load to prevent dialog from reopening
                setTool('select');
                
                // Callback
                onMemberSelected?.(hoveredMemberId, (startPos + endPos) / 2);
            }
            
            setIsDragging(false);
            gl.domElement.style.cursor = isLoadToolActive ? 'crosshair' : 'auto';
        };

        const handlePointerMove = () => {
            if (!isDragging && isLoadToolActive) {
                gl.domElement.style.cursor = hoveredMemberId ? 'pointer' : 'crosshair';
            }
        };

        gl.domElement.addEventListener('pointerdown', handlePointerDown);
        gl.domElement.addEventListener('pointerup', handlePointerUp);
        gl.domElement.addEventListener('pointermove', handlePointerMove);

        return () => {
            gl.domElement.removeEventListener('pointerdown', handlePointerDown);
            gl.domElement.removeEventListener('pointerup', handlePointerUp);
            gl.domElement.removeEventListener('pointermove', handlePointerMove);
            gl.domElement.style.cursor = 'auto';
        };
    }, [isLoadToolActive, hoveredMemberId, isDragging, dragStart, cursorRatio, dragEnd, addMemberLoad, setTool, onMemberSelected, gl, previewMagnitude]);

    // ---- Keyboard handling (ESC to exit) ----
    useEffect(() => {
        if (!isLoadToolActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setTool('select');
                setIsDragging(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLoadToolActive, setTool]);

    // ---- Reset on tool change ----
    useEffect(() => {
        if (!isLoadToolActive) {
            queueMicrotask(() => {
                setHoveredMemberId(null);
                setIsDragging(false);
                setShowPreview(false);
            });
        }
    }, [isLoadToolActive]);

    // ---- Get preview positions ----
    const previewData = useMemo(() => {
        if (!hoveredMemberId || !showPreview) return null;
        
        const geom = memberGeometries.find(g => g.id === hoveredMemberId);
        if (!geom) return null;
        
        const startPos = isDragging ? Math.min(dragStart, dragEnd) : cursorRatio;
        const endPos = isDragging ? Math.max(dragStart, dragEnd) : cursorRatio;
        
        const startPoint = new THREE.Vector3().lerpVectors(geom.start, geom.end, startPos);
        const endPoint = new THREE.Vector3().lerpVectors(geom.start, geom.end, endPos);
        
        const isPointLoad = Math.abs(endPos - startPos) < 0.05;
        
        return {
            start: startPoint,
            end: endPoint,
            isPointLoad,
            midPoint: new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.5)
        };
    }, [hoveredMemberId, showPreview, memberGeometries, isDragging, dragStart, dragEnd, cursorRatio]);

    if (!isLoadToolActive) return null;

    return (
        <group>
            {/* Highlight hovered/selected members */}
            {memberGeometries.map((geom) => {
                const isHovered = geom.id === hoveredMemberId;
                const isSelected = selectedIds.has(geom.id);
                
                if (!isHovered && !isSelected) return null;
                
                return (
                    <MemberHighlight
                        key={geom.id}
                        start={geom.start}
                        end={geom.end}
                        color={isSelected ? SELECTED_COLOR : HOVER_COLOR}
                        isHovered={isHovered}
                    />
                );
            })}
            
            {/* Load preview */}
            {previewData && (
                previewData.isPointLoad ? (
                    <PointLoadPreview
                        position={previewData.midPoint}
                        magnitude={previewMagnitude}
                    />
                ) : (
                    <UDLPreview
                        start={previewData.start}
                        end={previewData.end}
                        magnitude={previewMagnitude}
                    />
                )
            )}
            
            {/* Instruction tooltip */}
            {isLoadToolActive && !hoveredMemberId && (
                <Html position={[0, 2, 0]} center>
                    <div className="bg-white/90 dark:bg-slate-900/90 text-[#dae2fd] px-4 py-2 rounded-lg text-sm shadow-xl border border-[#1a2333]">
                        <div className="font-medium tracking-wide mb-1">🎯 Load Placement Mode</div>
                        <div className="text-[#869ab8] text-xs">
                            • Hover over a member to preview<br />
                            • Click to place point load<br />
                            • Drag to create UDL region
                        </div>
                    </div>
                </Html>
            )}
            
            {/* Dragging indicator */}
            {isDragging && previewData && (
                <Html position={[previewData.midPoint.x, previewData.midPoint.y + 1.5, previewData.midPoint.z]} center>
                    <div className="bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold animate-pulse">
                        Drag to set load length...
                    </div>
                </Html>
            )}
        </group>
    );
});

export default LoadPlacementLayer;
