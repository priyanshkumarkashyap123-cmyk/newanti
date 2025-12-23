/**
 * StructuralMesh.tsx - True Shape Renderer for Structural Members
 * 
 * Features:
 * - ExtrudeGeometry for I-beam, Tube, L-angle profiles
 * - Realistic steel material (roughness 0.4, metalness 0.6)
 * - Edge highlighting for CAD-like appearance
 * - Connection nodes with support visualizations
 * - Proper member orientation using lookAt()
 */

import { FC, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// TYPES
// ============================================

export type SectionType = 'I-BEAM' | 'TUBE' | 'L-ANGLE' | 'RECTANGLE' | 'CIRCLE' | 'C-CHANNEL';

export interface SectionDimensions {
    // I-Beam / C-Channel
    height?: number;      // Total height (mm)
    width?: number;       // Flange width (mm)
    webThickness?: number;
    flangeThickness?: number;

    // Tube / Rectangle
    outerWidth?: number;
    outerHeight?: number;
    innerWidth?: number;
    innerHeight?: number;
    thickness?: number;

    // Circle
    diameter?: number;
    innerDiameter?: number;

    // L-Angle
    legA?: number;
    legB?: number;
}

export type SupportType = 'none' | 'fixed' | 'pinned' | 'roller';

export interface NodeData {
    id: string;
    position: [number, number, number];
    support?: SupportType;
}

export interface MemberData {
    id: string;
    startNode: NodeData;
    endNode: NodeData;
    sectionType: SectionType;
    dimensions: SectionDimensions;
    color?: string;
}

// ============================================
// CONSTANTS
// ============================================

const STEEL_COLOR = '#b8b8b8';
const EDGE_COLOR = '#333333';
const EDGE_THRESHOLD = 15;

const FIXED_SUPPORT_COLOR = '#4a5568';
const PIN_SUPPORT_COLOR = '#48bb78';
const ROLLER_SUPPORT_COLOR = '#4299e1';
const CONNECTION_BALL_COLOR = '#718096';

const MM_TO_M = 0.001; // Convert mm to meters for Three.js

// ============================================
// SECTION GEOMETRY GENERATORS
// ============================================

/**
 * Create I-Beam profile shape
 */
function createIBeamShape(dims: SectionDimensions): THREE.Shape {
    const h = (dims.height || 200) * MM_TO_M;
    const w = (dims.width || 100) * MM_TO_M;
    const tw = (dims.webThickness || 8) * MM_TO_M;
    const tf = (dims.flangeThickness || 12) * MM_TO_M;

    const shape = new THREE.Shape();

    // Draw I-beam profile (centered at origin)
    // Start at bottom-left of bottom flange
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);           // Bottom flange bottom
    shape.lineTo(w / 2, -h / 2 + tf);      // Bottom flange right
    shape.lineTo(tw / 2, -h / 2 + tf);     // Web right bottom
    shape.lineTo(tw / 2, h / 2 - tf);      // Web right top
    shape.lineTo(w / 2, h / 2 - tf);       // Top flange right
    shape.lineTo(w / 2, h / 2);            // Top flange top-right
    shape.lineTo(-w / 2, h / 2);           // Top flange top-left
    shape.lineTo(-w / 2, h / 2 - tf);      // Top flange left
    shape.lineTo(-tw / 2, h / 2 - tf);     // Web left top
    shape.lineTo(-tw / 2, -h / 2 + tf);    // Web left bottom
    shape.lineTo(-w / 2, -h / 2 + tf);     // Bottom flange left
    shape.closePath();

    return shape;
}

/**
 * Create hollow tube/box shape
 */
function createTubeShape(dims: SectionDimensions): THREE.Shape {
    const ow = (dims.outerWidth || 100) * MM_TO_M;
    const oh = (dims.outerHeight || 100) * MM_TO_M;
    const t = (dims.thickness || 6) * MM_TO_M;

    const shape = new THREE.Shape();

    // Outer rectangle
    shape.moveTo(-ow / 2, -oh / 2);
    shape.lineTo(ow / 2, -oh / 2);
    shape.lineTo(ow / 2, oh / 2);
    shape.lineTo(-ow / 2, oh / 2);
    shape.closePath();

    // Inner hole (counter-clockwise for hole)
    const hole = new THREE.Path();
    const iw = ow - 2 * t;
    const ih = oh - 2 * t;
    hole.moveTo(-iw / 2, -ih / 2);
    hole.lineTo(-iw / 2, ih / 2);
    hole.lineTo(iw / 2, ih / 2);
    hole.lineTo(iw / 2, -ih / 2);
    hole.closePath();

    shape.holes.push(hole);

    return shape;
}

/**
 * Create L-angle shape
 */
function createLAngleShape(dims: SectionDimensions): THREE.Shape {
    const legA = (dims.legA || 75) * MM_TO_M;
    const legB = (dims.legB || 75) * MM_TO_M;
    const t = (dims.thickness || 8) * MM_TO_M;

    const shape = new THREE.Shape();

    // L-shape (corner at origin-ish)
    shape.moveTo(0, 0);
    shape.lineTo(legA, 0);           // Horizontal leg
    shape.lineTo(legA, t);           // Step up
    shape.lineTo(t, t);              // Corner
    shape.lineTo(t, legB);           // Vertical leg
    shape.lineTo(0, legB);           // Step left
    shape.closePath();

    // Center the shape
    shape.translate(-legA / 2, -legB / 2);

    return shape;
}

/**
 * Create C-channel shape
 */
function createCChannelShape(dims: SectionDimensions): THREE.Shape {
    const h = (dims.height || 150) * MM_TO_M;
    const w = (dims.width || 75) * MM_TO_M;
    const tw = (dims.webThickness || 6) * MM_TO_M;
    const tf = (dims.flangeThickness || 10) * MM_TO_M;

    const shape = new THREE.Shape();

    // C-channel (opening to the right)
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);           // Bottom flange outer
    shape.lineTo(w / 2, -h / 2 + tf);      // Bottom flange inner
    shape.lineTo(-w / 2 + tw, -h / 2 + tf); // Web bottom
    shape.lineTo(-w / 2 + tw, h / 2 - tf); // Web top
    shape.lineTo(w / 2, h / 2 - tf);       // Top flange inner
    shape.lineTo(w / 2, h / 2);            // Top flange outer
    shape.lineTo(-w / 2, h / 2);           // Web top outer
    shape.closePath();

    return shape;
}

/**
 * Create simple rectangle shape
 */
function createRectangleShape(dims: SectionDimensions): THREE.Shape {
    const w = (dims.width || 50) * MM_TO_M;
    const h = (dims.height || 100) * MM_TO_M;

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(w / 2, h / 2);
    shape.lineTo(-w / 2, h / 2);
    shape.closePath();

    return shape;
}

/**
 * Get section geometry based on type and dimensions
 */
export function getSectionGeometry(
    type: SectionType,
    dimensions: SectionDimensions,
    length: number
): THREE.ExtrudeGeometry {
    let shape: THREE.Shape;

    switch (type) {
        case 'I-BEAM':
            shape = createIBeamShape(dimensions);
            break;
        case 'TUBE':
            shape = createTubeShape(dimensions);
            break;
        case 'L-ANGLE':
            shape = createLAngleShape(dimensions);
            break;
        case 'C-CHANNEL':
            shape = createCChannelShape(dimensions);
            break;
        case 'RECTANGLE':
        default:
            shape = createRectangleShape(dimensions);
            break;
    }

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: length,
        bevelEnabled: false,
        steps: 1
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Rotate to align with Z-axis (extrusion goes along +Z by default)
    geometry.rotateX(Math.PI / 2);

    return geometry;
}

// ============================================
// STRUCTURAL MEMBER COMPONENT
// ============================================

interface StructuralMemberProps {
    member: MemberData;
    selected?: boolean;
    onSelect?: (id: string) => void;
}

export const StructuralMember: FC<StructuralMemberProps> = ({
    member,
    selected = false,
    onSelect
}) => {
    const groupRef = useRef<THREE.Group>(null);

    // Calculate member properties
    const { position, quaternion, length } = useMemo(() => {
        const start = new THREE.Vector3(...member.startNode.position);
        const end = new THREE.Vector3(...member.endNode.position);

        const memberLength = start.distanceTo(end);
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

        // Calculate rotation to align with member direction
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const up = new THREE.Vector3(0, 1, 0);

        // Create quaternion to rotate from Y-axis to member direction
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(up, direction);

        return {
            position: midpoint,
            quaternion: quat,
            length: memberLength
        };
    }, [member.startNode.position, member.endNode.position]);

    // Generate section geometry (memoized)
    const geometry = useMemo(() => {
        return getSectionGeometry(member.sectionType, member.dimensions, length);
    }, [member.sectionType, member.dimensions, length]);

    const handleClick = () => {
        if (onSelect) {
            onSelect(member.id);
        }
    };

    return (
        <group
            ref={groupRef}
            position={position}
            quaternion={quaternion}
        >
            {/* Main mesh */}
            <mesh
                geometry={geometry}
                onClick={handleClick}
            >
                <meshStandardMaterial
                    color={selected ? '#3b82f6' : (member.color || STEEL_COLOR)}
                    roughness={0.4}
                    metalness={0.6}
                    side={THREE.DoubleSide}
                />
                {/* Edge highlighting for CAD-like look */}
                <Edges
                    threshold={EDGE_THRESHOLD}
                    color={EDGE_COLOR}
                />
            </mesh>
        </group>
    );
};

// ============================================
// SUPPORT VISUALIZATION COMPONENTS
// ============================================

interface SupportVisualizationProps {
    node: NodeData;
    scale?: number;
}

/**
 * Fixed Support - Cube around node
 */
const FixedSupport: FC<SupportVisualizationProps> = ({ node, scale = 0.15 }) => {
    return (
        <mesh position={node.position}>
            <boxGeometry args={[scale, scale, scale]} />
            <meshStandardMaterial
                color={FIXED_SUPPORT_COLOR}
                roughness={0.3}
                metalness={0.7}
            />
            <Edges threshold={15} color="#222" />
        </mesh>
    );
};

/**
 * Pinned Support - Pyramid pointing up
 */
const PinnedSupport: FC<SupportVisualizationProps> = ({ node, scale = 0.15 }) => {
    const [x, y, z] = node.position;

    return (
        <group position={[x, y - scale / 2, z]}>
            <mesh rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[scale * 0.8, scale, 4]} />
                <meshStandardMaterial
                    color={PIN_SUPPORT_COLOR}
                    roughness={0.3}
                    metalness={0.5}
                />
                <Edges threshold={15} color="#222" />
            </mesh>
        </group>
    );
};

/**
 * Roller Support - Pyramid on wheels (spheres)
 */
const RollerSupport: FC<SupportVisualizationProps> = ({ node, scale = 0.15 }) => {
    const [x, y, z] = node.position;
    const wheelRadius = scale * 0.2;

    return (
        <group position={[x, y - scale / 2, z]}>
            {/* Pyramid */}
            <mesh rotation={[Math.PI, 0, 0]} position={[0, wheelRadius * 2, 0]}>
                <coneGeometry args={[scale * 0.8, scale, 4]} />
                <meshStandardMaterial
                    color={ROLLER_SUPPORT_COLOR}
                    roughness={0.3}
                    metalness={0.5}
                />
                <Edges threshold={15} color="#222" />
            </mesh>

            {/* Wheels */}
            <mesh position={[-scale * 0.3, wheelRadius, 0]}>
                <sphereGeometry args={[wheelRadius, 16, 16]} />
                <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[scale * 0.3, wheelRadius, 0]}>
                <sphereGeometry args={[wheelRadius, 16, 16]} />
                <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Ground line */}
            <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[scale * 1.5, 0.02]} />
                <meshBasicMaterial color="#666" side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

/**
 * Connection Ball - Sphere at node joints
 */
const ConnectionBall: FC<{ position: [number, number, number]; scale?: number }> = ({
    position,
    scale = 0.05
}) => {
    return (
        <mesh position={position}>
            <sphereGeometry args={[scale, 16, 16]} />
            <meshStandardMaterial
                color={CONNECTION_BALL_COLOR}
                roughness={0.3}
                metalness={0.7}
            />
        </mesh>
    );
};

/**
 * Render support based on type
 */
export const SupportVisualization: FC<SupportVisualizationProps> = ({ node, scale }) => {
    switch (node.support) {
        case 'fixed':
            return <FixedSupport node={node} scale={scale} />;
        case 'pinned':
            return <PinnedSupport node={node} scale={scale} />;
        case 'roller':
            return <RollerSupport node={node} scale={scale} />;
        default:
            return null;
    }
};

// ============================================
// MAIN STRUCTURAL MESH GROUP
// ============================================

interface StructuralMeshProps {
    nodes: NodeData[];
    members: MemberData[];
    showConnections?: boolean;
    showSupports?: boolean;
    selectedMemberId?: string | null;
    onSelectMember?: (id: string) => void;
    supportScale?: number;
}

export const StructuralMesh: FC<StructuralMeshProps> = ({
    nodes,
    members,
    showConnections = true,
    showSupports = true,
    selectedMemberId,
    onSelectMember,
    supportScale = 0.15
}) => {
    return (
        <group name="structural-mesh">
            {/* Render all members */}
            {members.map((member) => (
                <StructuralMember
                    key={member.id}
                    member={member}
                    selected={selectedMemberId === member.id}
                    onSelect={onSelectMember}
                />
            ))}

            {/* Render connection balls at nodes */}
            {showConnections && nodes.map((node) => (
                <ConnectionBall
                    key={`conn-${node.id}`}
                    position={node.position}
                />
            ))}

            {/* Render support visualizations */}
            {showSupports && nodes.filter(n => n.support && n.support !== 'none').map((node) => (
                <SupportVisualization
                    key={`support-${node.id}`}
                    node={node}
                    scale={supportScale}
                />
            ))}
        </group>
    );
};

export default StructuralMesh;
