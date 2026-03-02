/**
 * ============================================================================
 * CONNECTION 3D VISUALIZATION - Three.js Based Connection Renderer
 * ============================================================================
 *
 * Interactive 3D visualization of bolted connections using React Three Fiber
 * Features: Realistic bolt/plate rendering, stress visualization, animations
 *
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

import React, {
  useRef,
  useMemo,
  useState,
  useCallback,
  useEffect,
  Suspense,
} from "react";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Html,
  useHelper,
  Grid,
  Center,
  Text3D,
  Float,
  Edges,
} from "@react-three/drei";
import * as THREE from "three";
import {
  BoltPattern,
  BoltPosition,
  ConnectionPlate,
  BoltForces,
} from "../types/BoltedConnectionTypes";

// ============================================================================
// MODULE-LEVEL BOLT GEOMETRY CACHE  (avoids N×5 allocations for identical bolts)
// ============================================================================
const _boltGeoCache = new Map<string, THREE.BufferGeometry>();
const BOLT_SEGMENTS = 16; // was 32 — halves vertex count per bolt

function cachedCylinder(
  key: string,
  radiusTop: number,
  radiusBottom: number,
  height: number,
): THREE.CylinderGeometry {
  if (!_boltGeoCache.has(key)) {
    _boltGeoCache.set(
      key,
      new THREE.CylinderGeometry(
        radiusTop,
        radiusBottom,
        height,
        BOLT_SEGMENTS,
      ),
    );
  }
  return _boltGeoCache.get(key) as THREE.CylinderGeometry;
}

function cachedHexHead(
  key: string,
  diameter: number,
  height: number,
): THREE.ExtrudeGeometry {
  if (!_boltGeoCache.has(key)) {
    _boltGeoCache.set(key, createHexBoltHeadGeometry(diameter, height));
  }
  return _boltGeoCache.get(key) as THREE.ExtrudeGeometry;
}

// ============================================================================
// INTERFACES
// ============================================================================

interface Connection3DVisualizationProps {
  boltPattern: BoltPattern;
  plates?: ConnectionPlate[];
  boltForces?: Map<string, BoltForces>;
  showStressColors?: boolean;
  showForceVectors?: boolean;
  showDimensions?: boolean;
  showLabels?: boolean;
  viewMode?: "3D" | "PLAN" | "ELEVATION" | "SECTION";
  highlightedBolt?: string;
  onBoltSelect?: (boltId: string) => void;
  maxUtilization?: number;
}

interface BoltMeshProps {
  position: [number, number, number];
  diameter: number;
  length: number;
  utilization?: number;
  isHighlighted?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  showLabel?: boolean;
  label?: string;
  forces?: BoltForces;
  showForceVector?: boolean;
}

interface PlateMeshProps {
  width: number;
  height: number;
  thickness: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  holes?: { x: number; y: number; diameter: number }[];
  color?: string;
  opacity?: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get color based on utilization ratio
 */
function getUtilizationColor(utilization: number): string {
  if (utilization <= 0.5) return "#22C55E"; // Green
  if (utilization <= 0.75) return "#EAB308"; // Yellow
  if (utilization <= 0.9) return "#F97316"; // Orange
  if (utilization <= 1.0) return "#EF4444"; // Red
  return "#DC2626"; // Dark red (overstressed)
}

/**
 * Create hex bolt head geometry
 */
function createHexBoltHeadGeometry(
  diameter: number,
  height: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const radius = diameter * 0.75; // Head is larger than shank
  const sides = 6;

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();

  const extrudeSettings = {
    depth: height,
    bevelEnabled: true,
    bevelThickness: height * 0.1,
    bevelSize: radius * 0.05,
    bevelSegments: 2,
  };

  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

// ============================================================================
// BOLT MESH COMPONENT
// ============================================================================

const BoltMesh: React.FC<BoltMeshProps> = ({
  position,
  diameter,
  length,
  utilization = 0,
  isHighlighted = false,
  isSelected = false,
  onClick,
  onHover,
  showLabel = false,
  label = "",
  forces,
  showForceVector = false,
}) => {
  const boltRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Memoize geometries — shared via module-level cache
  const shankGeometry = useMemo(
    () =>
      cachedCylinder(
        `shank_${diameter}_${length}`,
        diameter / 2,
        diameter / 2,
        length * 0.7,
      ),
    [diameter, length],
  );

  const threadGeometry = useMemo(
    () =>
      cachedCylinder(
        `thread_${diameter}_${length}`,
        (diameter / 2) * 0.9,
        diameter / 2,
        length * 0.3,
      ),
    [diameter, length],
  );

  const headGeometry = useMemo(
    () => cachedHexHead(`head_${diameter}`, diameter, diameter * 0.65),
    [diameter],
  );

  const washerGeometry = useMemo(
    () =>
      cachedCylinder(
        `washer_${diameter}`,
        diameter,
        diameter * 0.6,
        diameter * 0.15,
      ),
    [diameter],
  );

  const nutGeometry = useMemo(
    () => cachedHexHead(`nut_${diameter}`, diameter * 0.95, diameter * 0.8),
    [diameter],
  );

  // Cache-managed — no per-bolt dispose needed

  // Colors
  const baseColor = useMemo(() => {
    if (isSelected) return "#3B82F6";
    if (isHighlighted) return "#F59E0B";
    if (utilization > 0) return getUtilizationColor(utilization);
    return "#71717A";
  }, [utilization, isHighlighted, isSelected]);

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
      onHover?.(true);
      document.body.style.cursor = "pointer";
    },
    [onHover],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(false);
      onHover?.(false);
      document.body.style.cursor = "default";
    },
    [onHover],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick?.();
    },
    [onClick],
  );

  // Animation
  useFrame((state) => {
    if (boltRef.current && (hovered || isSelected)) {
      boltRef.current.scale.setScalar(
        1 + Math.sin(state.clock.elapsedTime * 4) * 0.02,
      );
    } else if (boltRef.current) {
      boltRef.current.scale.setScalar(1);
    }
  });

  return (
    <group
      ref={boltRef}
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Bolt Head */}
      <mesh
        geometry={headGeometry}
        position={[0, length / 2 + diameter * 0.3, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color={baseColor}
          metalness={0.8}
          roughness={0.2}
          emissive={hovered ? baseColor : "#000000"}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
      </mesh>

      {/* Top Washer */}
      <mesh geometry={washerGeometry} position={[0, length / 2, 0]}>
        <meshStandardMaterial color="#A1A1AA" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Bolt Shank */}
      <mesh geometry={shankGeometry} position={[0, length * 0.15, 0]}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Threaded Portion */}
      <mesh geometry={threadGeometry} position={[0, -length * 0.35, 0]}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Bottom Washer */}
      <mesh geometry={washerGeometry} position={[0, -length / 2, 0]}>
        <meshStandardMaterial color="#A1A1AA" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Nut */}
      <mesh
        geometry={nutGeometry}
        position={[0, -length / 2 - diameter * 0.4, 0]}
        rotation={[Math.PI / 2, Math.PI / 6, 0]}
      >
        <meshStandardMaterial color="#52525B" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Force Vector */}
      {showForceVector && forces && (
        <group>
          {/* Shear Force Arrow */}
          {forces.resultantShear > 0 && (
            <arrowHelper
              args={[
                new THREE.Vector3(
                  Math.cos((forces.shearAngle * Math.PI) / 180),
                  0,
                  Math.sin((forces.shearAngle * Math.PI) / 180),
                ),
                new THREE.Vector3(0, 0, 0),
                Math.min(forces.resultantShear / 10, diameter * 3),
                0x3b82f6,
                diameter * 0.5,
                diameter * 0.3,
              ]}
            />
          )}

          {/* Tension Force Arrow */}
          {forces.totalTension > 0 && (
            <arrowHelper
              args={[
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, length / 2 + diameter * 0.5, 0),
                Math.min(forces.totalTension / 10, diameter * 2),
                0xef4444,
                diameter * 0.4,
                diameter * 0.25,
              ]}
            />
          )}
        </group>
      )}

      {/* Label */}
      {(showLabel || hovered) && (
        <Html
          position={[0, length / 2 + diameter * 2, 0]}
          center
          distanceFactor={100}
          style={{
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div
            style={{
              background: isSelected ? "#3B82F6" : "rgba(0,0,0,0.8)",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
            }}
          >
            {label}
            {utilization > 0 && (
              <span
                style={{
                  marginLeft: "4px",
                  color: getUtilizationColor(utilization),
                }}
              >
                ({(utilization * 100).toFixed(0)}%)
              </span>
            )}
          </div>
        </Html>
      )}

      {/* Selection ring */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[diameter * 1.5, diameter * 1.7, 32]} />
          <meshBasicMaterial
            color={isSelected ? "#3B82F6" : "#F59E0B"}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};

// ============================================================================
// PLATE MESH COMPONENT
// ============================================================================

const PlateMesh: React.FC<PlateMeshProps> = ({
  width,
  height,
  thickness,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  holes = [],
  color = "#52525B",
  opacity = 0.9,
}) => {
  const plateShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.closePath();

    // Add holes
    holes.forEach((hole) => {
      const holePath = new THREE.Path();
      holePath.absarc(
        hole.x - width / 2,
        hole.y - height / 2,
        hole.diameter / 2,
        0,
        Math.PI * 2,
        false,
      );
      shape.holes.push(holePath);
    });

    return shape;
  }, [width, height, holes]);

  const geometry = useMemo(() => {
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: thickness * 0.05,
      bevelSize: thickness * 0.03,
      bevelSegments: 2,
    };
    return new THREE.ExtrudeGeometry(plateShape, extrudeSettings);
  }, [plateShape, thickness]);

  // Dispose plate geometry on unmount / deps change
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation as unknown as THREE.Euler}
    >
      <meshStandardMaterial
        color={color}
        metalness={0.6}
        roughness={0.4}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
      <Edges color="#1F2937" threshold={15} />
    </mesh>
  );
};

// ============================================================================
// DIMENSION LINE COMPONENT
// ============================================================================

interface DimensionLineProps {
  start: [number, number, number];
  end: [number, number, number];
  offset?: number;
  label: string;
  color?: string;
}

const DimensionLine: React.FC<DimensionLineProps> = ({
  start,
  end,
  offset = 5,
  label,
  color = "#3B82F6",
}) => {
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  const midpoint = startVec.clone().add(endVec).multiplyScalar(0.5);

  const direction = endVec.clone().sub(startVec).normalize();
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);

  const offsetStart = startVec
    .clone()
    .add(perpendicular.clone().multiplyScalar(offset));
  const offsetEnd = endVec
    .clone()
    .add(perpendicular.clone().multiplyScalar(offset));
  const labelPos = midpoint
    .clone()
    .add(perpendicular.clone().multiplyScalar(offset + 3));

  return (
    <group>
      {/* Main line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={
              new Float32Array([
                ...offsetStart.toArray(),
                ...offsetEnd.toArray(),
              ])
            }
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} />
      </line>

      {/* Extension lines */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([...start, ...offsetStart.toArray()])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} opacity={0.5} transparent />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([...end, ...offsetEnd.toArray()])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} opacity={0.5} transparent />
      </line>

      {/* Label */}
      <Html position={labelPos.toArray() as [number, number, number]} center>
        <div
          style={{
            background: "#1e293b",
            padding: "2px 6px",
            borderRadius: "3px",
            fontSize: "9px",
            fontWeight: "bold",
            color: color,
            border: `1px solid ${color}`,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
};

// ============================================================================
// SCENE COMPONENT
// ============================================================================

interface SceneProps extends Connection3DVisualizationProps {}

const Scene: React.FC<SceneProps> = ({
  boltPattern,
  plates = [],
  boltForces,
  showStressColors = true,
  showForceVectors = false,
  showDimensions = false,
  showLabels = false,
  highlightedBolt,
  onBoltSelect,
  maxUtilization = 1,
}) => {
  const [selectedBolt, setSelectedBolt] = useState<string | null>(null);

  // Calculate pattern center for proper positioning
  const patternCenter = useMemo(() => {
    const { centroid } = boltPattern;
    return { x: centroid.x, y: centroid.y };
  }, [boltPattern]);

  // Scale factor to fit in view
  const scale = 0.05;

  const handleBoltClick = useCallback(
    (boltId: string) => {
      setSelectedBolt((prev) => (prev === boltId ? null : boltId));
      onBoltSelect?.(boltId);
    },
    [onBoltSelect],
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} />

      {/* Engineering-grade local lighting (no remote HDR fetch) */}
      <hemisphereLight args={["#b1e1ff", "#b97a20", 0.6]} />

      {/* Main Connection Group */}
      <group scale={[scale, scale, scale]}>
        {/* Plate(s) */}
        {plates.length > 0 ? (
          plates.map((plate, index) => {
            const holes = boltPattern.positions
              .filter((p) => p.isActive)
              .map((pos) => ({
                x: pos.x,
                y: pos.y,
                diameter: boltPattern.defaultBoltSpec.geometry.diameter + 2,
              }));

            return (
              <PlateMesh
                key={plate.id || index}
                width={plate.width}
                height={plate.height}
                thickness={plate.thickness}
                position={[0, -plate.thickness / 2, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                holes={holes}
                color="#6B7280"
                opacity={0.85}
              />
            );
          })
        ) : (
          // Default plate based on pattern
          <PlateMesh
            width={
              boltPattern.edgeDistanceLeft * 2 +
              (boltPattern.numColumns - 1) * boltPattern.pitchHorizontal +
              20
            }
            height={
              boltPattern.edgeDistanceTop * 2 +
              (boltPattern.numRows - 1) * boltPattern.pitchVertical +
              20
            }
            thickness={10}
            position={[patternCenter.x - 10, -5, patternCenter.y - 10]}
            rotation={[Math.PI / 2, 0, 0]}
            holes={boltPattern.positions
              .filter((p) => p.isActive)
              .map((pos) => ({
                x: pos.x + 10,
                y: pos.y + 10,
                diameter: boltPattern.defaultBoltSpec.geometry.diameter + 2,
              }))}
            color="#6B7280"
            opacity={0.85}
          />
        )}

        {/* Bolts */}
        {boltPattern.positions
          .filter((pos) => pos.isActive)
          .map((pos) => {
            const forces = boltForces?.get(pos.id);
            const utilization = forces ? forces.combinedRatio : 0;

            return (
              <BoltMesh
                key={pos.id}
                position={[pos.x - patternCenter.x, 0, pos.y - patternCenter.y]}
                diameter={boltPattern.defaultBoltSpec.geometry.diameter}
                length={30}
                utilization={showStressColors ? utilization : 0}
                isHighlighted={highlightedBolt === pos.id}
                isSelected={selectedBolt === pos.id}
                onClick={() => handleBoltClick(pos.id)}
                showLabel={showLabels}
                label={`${pos.row},${pos.column}`}
                forces={forces}
                showForceVector={showForceVectors}
              />
            );
          })}

        {/* Dimension Lines */}
        {showDimensions && boltPattern.numRows > 1 && (
          <DimensionLine
            start={[
              boltPattern.positions[0].x - patternCenter.x,
              15,
              boltPattern.positions[0].y - patternCenter.y,
            ]}
            end={[
              boltPattern.positions[boltPattern.numColumns].x - patternCenter.x,
              15,
              boltPattern.positions[boltPattern.numColumns].y - patternCenter.y,
            ]}
            offset={20}
            label={`${boltPattern.pitchVertical}mm`}
          />
        )}

        {showDimensions && boltPattern.numColumns > 1 && (
          <DimensionLine
            start={[
              boltPattern.positions[0].x - patternCenter.x,
              15,
              boltPattern.positions[0].y - patternCenter.y,
            ]}
            end={[
              boltPattern.positions[1].x - patternCenter.x,
              15,
              boltPattern.positions[1].y - patternCenter.y,
            ]}
            offset={20}
            label={`${boltPattern.pitchHorizontal}mm`}
          />
        )}
      </group>

      {/* Ground shadow plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.25} />
      </mesh>

      {/* Reference grid */}
      <Grid
        position={[0, -1.01, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6B7280"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#374151"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
      />
    </>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Connection3DVisualization: React.FC<
  Connection3DVisualizationProps
> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "400px",
        background: "linear-gradient(180deg, #1F2937 0%, #374151 100%)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [8, 8, 8], fov: 50 }}
      >
        <Suspense fallback={null}>
          <Scene {...props} />
          <OrbitControls
            makeDefault
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 1.5}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={3}
            maxDistance={50}
          />
        </Suspense>
      </Canvas>

      {/* Legend */}
      {props.showStressColors && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "16px",
            background: "rgba(0,0,0,0.8)",
            padding: "12px",
            borderRadius: "8px",
            color: "white",
            fontSize: "11px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
            Utilization
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                background: "#22C55E",
                borderRadius: "2px",
              }}
            />
            <span>≤ 50%</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                background: "#EAB308",
                borderRadius: "2px",
              }}
            />
            <span>50-75%</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                background: "#F97316",
                borderRadius: "2px",
              }}
            />
            <span>75-90%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                background: "#EF4444",
                borderRadius: "2px",
              }}
            />
            <span>&gt; 90%</span>
          </div>
        </div>
      )}

      {/* View Controls */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {["3D", "Plan", "Front", "Side"].map((view) => (
          <button type="button"
            key={view}
            style={{
              padding: "8px 12px",
              background: "rgba(255,255,255,0.9)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "bold",
            }}
          >
            {view}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Connection3DVisualization;
