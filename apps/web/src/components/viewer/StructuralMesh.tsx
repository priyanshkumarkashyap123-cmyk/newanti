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
import { Edges, Outlines } from '@react-three/drei';
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
    betaAngle?: number; // Rotation in degrees
}

// ============================================
// CONSTANTS
// ============================================

const STEEL_COLOR = '#b8b8b8';          // Bright steel gray
const CONCRETE_COLOR = '#c0c0c0';       // Light gray for concrete
const CABLE_COLOR = '#606060';          // Darker gray for cables
const EDGE_COLOR = '#333333';
const EDGE_THRESHOLD = 15;

const FIXED_SUPPORT_COLOR = '#4a5568';
const PIN_SUPPORT_COLOR = '#48bb78';
const ROLLER_SUPPORT_COLOR = '#4299e1';
const CONNECTION_BALL_COLOR = '#718096';

const MM_TO_M = 0.001; // Convert mm to meters for Three.js

/**
 * Get material color based on section type
 */
function getMaterialColor(sectionType: SectionType): string {
    switch (sectionType) {
        case 'RECTANGLE':
            return CONCRETE_COLOR;  // Rectangular sections are typically concrete
        case 'CIRCLE':
            return CABLE_COLOR;     // Circular sections are cables
        case 'I-BEAM':
        case 'C-CHANNEL':
        case 'L-ANGLE':
        case 'TUBE':
        default:
            return STEEL_COLOR;     // I-beams, tubes, angles are steel
    }
}

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

    // Center the shape by adjusting moveTo and lineTo starting positions
    // Note: Using offset coordinates instead of translate() method
    const offsetX = -legA / 2;
    const offsetY = -legB / 2;

    // Recreate shape with offset
    shape.moveTo(offsetX, offsetY);
    shape.lineTo(legA + offsetX, offsetY);           // Horizontal leg
    shape.lineTo(legA + offsetX, t + offsetY);       // Step up
    shape.lineTo(t + offsetX, t + offsetY);          // Corner
    shape.lineTo(t + offsetX, legB + offsetY);       // Vertical leg
    shape.lineTo(offsetX, legB + offsetY);           // Step left
    shape.closePath();

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
 * Create circular shape (for cables, pipes)
 */
function createCircleShape(dims: SectionDimensions): THREE.Shape {
    const diameter = (dims.diameter || 100) * MM_TO_M;
    const radius = diameter / 2;

    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);

    // Add inner hole if hollow
    if (dims.innerDiameter) {
        const innerRadius = (dims.innerDiameter * MM_TO_M) / 2;
        const hole = new THREE.Path();
        hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
        shape.holes.push(hole);
    }

    return shape;
}

/**
 * Get section geometry based on type and dimensions
 * The geometry is created CENTERED at origin, with member axis along Y
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
        case 'CIRCLE':
            shape = createCircleShape(dimensions);
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

    // The extrusion goes along +Z by default
    // We need to:
    // 1. Center the geometry along its length (translate by -length/2 in extrusion direction)
    // 2. Rotate so the member axis is along Y (standard structural convention)

    // First translate to center along extrusion axis (Z)
    geometry.translate(0, 0, -length / 2);

    // Then rotate so extrusion axis (Z) becomes Y-axis (member longitudinal axis)
    // Rotate -90° around X to bring Z to Y
    geometry.rotateX(-Math.PI / 2);

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

/**
 * Determines if a member is primarily vertical (column) or horizontal (beam)
 * This affects cross-section orientation
 */
function getMemberOrientation(start: THREE.Vector3, end: THREE.Vector3): 'vertical' | 'horizontal' | 'inclined' {
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const verticalThreshold = 0.7; // cos(45°) ≈ 0.707

    if (Math.abs(direction.y) > verticalThreshold) {
        return 'vertical';
    } else if (Math.abs(direction.y) < 0.3) {
        return 'horizontal';
    }
    return 'inclined';
}

export const StructuralMember: FC<StructuralMemberProps> = ({
    member,
    selected = false,
    onSelect
}) => {
    const groupRef = useRef<THREE.Group>(null);

    // Calculate member position, orientation, and length
    const { position, matrix, length, isValid } = useMemo(() => {
        // Validate member node positions
        if (!member.startNode?.position || !member.endNode?.position) {
            console.warn(`[StructuralMember] Invalid member positions for ${member.id}`);
            return { position: new THREE.Vector3(), matrix: new THREE.Matrix4(), length: 0, isValid: false };
        }
        
        // Validate position arrays have 3 elements
        if (member.startNode.position.length < 3 || member.endNode.position.length < 3) {
            console.warn(`[StructuralMember] Incomplete position data for ${member.id}`);
            return { position: new THREE.Vector3(), matrix: new THREE.Matrix4(), length: 0, isValid: false };
        }
        
        // Check for NaN values
        const startPos = member.startNode.position;
        const endPos = member.endNode.position;
        if (startPos.some(isNaN) || endPos.some(isNaN)) {
            console.warn(`[StructuralMember] NaN values in positions for ${member.id}`);
            return { position: new THREE.Vector3(), matrix: new THREE.Matrix4(), length: 0, isValid: false };
        }
        
        const start = new THREE.Vector3(...member.startNode.position);
        const end = new THREE.Vector3(...member.endNode.position);

        const memberLength = start.distanceTo(end);
        
        // Check for zero-length members
        if (memberLength < 0.001) {
            console.warn(`[StructuralMember] Zero-length member: ${member.id}`);
            return { position: new THREE.Vector3(), matrix: new THREE.Matrix4(), length: 0, isValid: false };
        }
        
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

        // Member direction vector
        const direction = new THREE.Vector3().subVectors(end, start).normalize();

        // Determine member type for proper cross-section orientation
        const memberType = getMemberOrientation(start, end);

        // Create transformation matrix
        const mat = new THREE.Matrix4();

        // We need to construct a rotation that:
        // 1. Aligns the Y-axis (our geometry's longitudinal axis) with the member direction
        // 2. Orients the cross-section properly based on member type

        // For the cross-section (XZ plane in local coords after geometry rotation):
        // - Beams (horizontal): Web should be vertical (resist gravity bending)
        //   The I-beam shape has height along Y in the shape, which becomes Z after -90° X rotation
        //   So after positioning, the "up" direction of the section should remain world-Y
        // - Columns (vertical): Web typically faces the direction of lateral load/framing

        // Create a local coordinate system
        const localY = direction.clone(); // Member axis
        let localZ: THREE.Vector3;
        let localX: THREE.Vector3;

        if (memberType === 'vertical') {
            // Column: web can face X direction (typical for framing)
            // Local X should be horizontal
            localZ = new THREE.Vector3(0, 0, 1); // Try Z direction
            if (Math.abs(direction.dot(localZ)) > 0.99) {
                localZ = new THREE.Vector3(1, 0, 0); // Fall back to X
            }
            localX = new THREE.Vector3().crossVectors(localY, localZ).normalize();
            localZ = new THREE.Vector3().crossVectors(localX, localY).normalize();
        } else {
            // Beam or inclined: web should be vertical (resist bending about major axis)
            // Local Z should be horizontal, Local X should point "up" as much as possible
            const worldUp = new THREE.Vector3(0, 1, 0);

            // Find the "up" direction perpendicular to beam
            localX = new THREE.Vector3().crossVectors(worldUp, direction);

            if (localX.length() < 0.001) {
                // Direction is nearly vertical, use X as reference
                localX = new THREE.Vector3(1, 0, 0);
            }
            localX.normalize();

            // Local Z is perpendicular to both member direction and "up"
            localZ = new THREE.Vector3().crossVectors(direction, localX).normalize();

            // Ensure right-handed coordinate system
            localX = new THREE.Vector3().crossVectors(localY, localZ).normalize();
        }

        // Apply Beta Angle Rotation (roll around local Y axis)
        if (member.betaAngle) {
            const rad = member.betaAngle * (Math.PI / 180);
            // Rotate localX and localZ around localY
            localX.applyAxisAngle(localY, rad);
            localZ.applyAxisAngle(localY, rad);
        }

        // Build rotation matrix from local coordinate system
        // The geometry's local Y is the member axis (already aligned)
        // We need to orient X and Z properly
        mat.makeBasis(localX, localY, localZ);
        mat.setPosition(midpoint);

        return {
            position: midpoint,
            matrix: mat,
            length: memberLength,
            isValid: true
        };
    }, [member.startNode.position, member.endNode.position, member.betaAngle, member.id]);

    // Generate section geometry (memoized) - must be before any conditional returns
    const geometry = useMemo(() => {
        if (!isValid || length <= 0) return null;
        return getSectionGeometry(member.sectionType, member.dimensions, length);
    }, [member.sectionType, member.dimensions, length, isValid]);

    // Determine material color based on section type (concrete vs steel vs cable)
    const materialColor = useMemo(() => {
        if (selected) return '#3b82f6';  // Blue when selected
        if (member.color) return member.color;  // Use custom color if provided
        return getMaterialColor(member.sectionType);  // Auto-detect based on section type
    }, [selected, member.color, member.sectionType]);

    // Adjust material properties based on type
    const materialProps = useMemo(() => {
        if (member.sectionType === 'RECTANGLE') {
            // Concrete - less metallic, more rough
            return { roughness: 0.7, metalness: 0.1 };
        } else if (member.sectionType === 'CIRCLE') {
            // Cables - slightly metallic, smooth
            return { roughness: 0.3, metalness: 0.7 };
        } else {
            // Steel - metallic, semi-rough
            return { roughness: 0.4, metalness: 0.6 };
        }
    }, [member.sectionType]);

    // Don't render invalid members
    if (!isValid) {
        return null;
    }

    // Don't render if geometry failed
    if (!geometry) {
        return null;
    }

    const handleClick = (e: any) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect(member.id);
        }
    };

    return (
        <group
            ref={groupRef}
            matrixAutoUpdate={false}
            matrix={matrix}
        >
            {/* Main mesh */}
            <mesh
                geometry={geometry}
                onClick={handleClick}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    document.body.style.cursor = 'auto';
                }}
            >
                <meshStandardMaterial
                    color={materialColor}
                    roughness={materialProps.roughness}
                    metalness={materialProps.metalness}
                    side={THREE.DoubleSide}
                />
                {/* Edge highlighting for CAD-like look */}
                <Edges
                    threshold={EDGE_THRESHOLD}
                    color={EDGE_COLOR}
                />

                {/* Selection Outline - Premium Glow Effect */}
                {selected && (
                    <Outlines thickness={3} color="#ffffff" angle={0} />
                )}
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
