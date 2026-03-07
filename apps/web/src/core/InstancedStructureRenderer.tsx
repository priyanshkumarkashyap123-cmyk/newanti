/**
 * InstancedStructureRenderer — Single-draw-call GPU instanced renderer
 *
 * Why this exists:
 *   Drawing 20,000 individual TubeGeometry beams with separate draw calls
 *   drops to ~2 FPS.  This component renders the ENTIRE structure in
 *   ONE draw call using InstancedMesh with custom vertex/fragment shaders.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  InstancedStructureRenderer                                     │
 *   │                                                                 │
 *   │  GPU Instance Attributes (per-member):                         │
 *   │    instanceStart  Float32×3  — start node world position        │
 *   │    instanceEnd    Float32×3  — end node world position          │
 *   │    instanceColor  Float32×3  — per-member color (selection etc) │
 *   │    instanceFlags  Float32×1  — selection/hover/error bitmask    │
 *   │                                                                 │
 *   │  Vertex Shader:                                                 │
 *   │    Orients unit cylinder to match start→end vector per instance │
 *   │    Applies radius scaling                                       │
 *   │                                                                 │
 *   │  Fragment Shader:                                               │
 *   │    Per-instance color from attribute + lighting                 │
 *   │    Selection glow effect from flags                             │
 *   │                                                                 │
 *   │  Dirty Update Pipeline:                                         │
 *   │    StructuralBufferPool.getDirtyNodes() →                      │
 *   │      partial attribute update (no full rebuild) →              │
 *   │      attribute.needsUpdate = true                              │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * @module core/InstancedStructureRenderer
 */

import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useModelStore } from '../store/model';
import { useShallow } from 'zustand/react/shallow';
import { getBufferPool } from './StructuralBufferPool';

// ─── Shader Source ──────────────────────────────────────────────────

/**
 * Custom vertex shader: orients a unit Y-axis cylinder from instanceStart to instanceEnd.
 *
 * Per-instance attributes:
 *   instanceStart (vec3) — world position of member start node
 *   instanceEnd   (vec3) — world position of member end node
 *   instanceColor (vec3) — per-member base color
 *   instanceFlags (float) — bitmask: bit0=selected, bit1=hovered, bit2=error
 *
 * The geometry is a unit cylinder along Y from 0 to 1, radius 1.
 * The shader scales Y to member length, XZ to memberRadius, then rotates
 * from Y-axis to the start→end direction via a quaternion-free basis matrix.
 */
const MEMBER_VERTEX_SHADER = /* glsl */ `
  precision highp float;

  // Per-instance attributes
  attribute vec3 instanceStart;
  attribute vec3 instanceEnd;
  attribute vec3 instanceColor;
  attribute float instanceFlags;

  // Uniforms
  uniform float memberRadius;
  uniform float selectedPulse; // 0..1 animated pulse for selected glow

  // Varyings to fragment
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vFlags;

  void main() {
    // ── Build local frame from start→end ──
    vec3 dir = instanceEnd - instanceStart;
    float len = length(dir);
    if (len < 0.0001) {
      // Degenerate member — collapse to zero
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec3 axis = dir / len; // normalized direction

    // Build an orthonormal basis: axis = local Y, tangent = local X, bitangent = local Z
    vec3 up = abs(axis.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, axis));
    vec3 bitangent = cross(axis, tangent);

    // Basis matrix (columns = tangent, axis, bitangent)
    mat3 basis = mat3(tangent, axis, bitangent);

    // Scale the unit cylinder: XZ by radius, Y by length
    // The unit cylinder has position.y in [0, 1], position.xz on unit circle
    vec3 scaled = vec3(
      position.x * memberRadius,
      position.y * len,
      position.z * memberRadius
    );

    // Rotate into world orientation and translate to start
    vec3 worldPos = basis * scaled + instanceStart;

    // Transform normal into world space (basis is orthonormal, no inverse needed)
    vec3 localNormal = vec3(normal.x, 0.0, normal.z); // cylinder normals are radial
    vNormal = normalize(basis * localNormal);
    vWorldPosition = worldPos;

    // Pass color and flags
    vColor = instanceColor;
    vFlags = instanceFlags;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
  }
`;

/**
 * Custom fragment shader: per-instance coloring with Phong-like lighting
 * and selection/hover glow effect from flags.
 */
const MEMBER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vFlags;

  uniform float selectedPulse;
  uniform vec3 ambientColor;
  uniform vec3 lightDir;
  uniform vec3 lightColor;
  uniform vec3 cameraPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 baseColor = vColor;

    // Decode flags
    int flags = int(vFlags + 0.5);
    bool isSelected = (flags / 1 - (flags / 2) * 2) == 1;
    bool isHovered  = (flags / 2 - (flags / 4) * 2) == 1;
    bool isError    = (flags / 4 - (flags / 8) * 2) == 1;

    // Override color based on state
    if (isError) {
      baseColor = vec3(0.937, 0.267, 0.267); // #ef4444 red
    }
    if (isSelected) {
      float pulse = 0.85 + 0.15 * selectedPulse;
      baseColor = mix(baseColor, vec3(0.984, 0.749, 0.141), 0.7) * pulse; // amber glow
    }
    if (isHovered) {
      baseColor = mix(baseColor, vec3(0.0, 1.0, 1.0), 0.5); // cyan hover
    }

    // Simple Phong lighting
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

    vec3 ambient = ambientColor * baseColor;
    vec3 diffuse = lightColor * baseColor * diff;
    vec3 specular = lightColor * spec * 0.3;

    gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
  }
`;

// ─── Node Vertex/Fragment Shaders ───────────────────────────────────

const NODE_VERTEX_SHADER = /* glsl */ `
  precision highp float;

  attribute vec3 instancePosition;
  attribute vec3 instanceColor;
  attribute float instanceFlags;

  uniform float nodeRadius;
  uniform float selectedPulse;

  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vFlags;

  void main() {
    // Scale unit sphere by nodeRadius and translate to instance position
    vec3 worldPos = position * nodeRadius + instancePosition;

    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = worldPos;
    vColor = instanceColor;
    vFlags = instanceFlags;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
  }
`;

const NODE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vFlags;

  uniform float selectedPulse;
  uniform vec3 ambientColor;
  uniform vec3 lightDir;
  uniform vec3 lightColor;
  uniform vec3 cameraPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 baseColor = vColor;

    int flags = int(vFlags + 0.5);
    bool isSelected = (flags / 1 - (flags / 2) * 2) == 1;
    bool isHovered  = (flags / 2 - (flags / 4) * 2) == 1;
    bool isRestrained = (flags / 4 - (flags / 8) * 2) == 1;

    if (isRestrained) {
      baseColor = vec3(0.0, 0.8, 0.0); // green for supports
    }
    if (isSelected) {
      float pulse = 0.85 + 0.15 * selectedPulse;
      baseColor = mix(baseColor, vec3(0.984, 0.749, 0.141), 0.7) * pulse;
    }
    if (isHovered) {
      baseColor = mix(baseColor, vec3(0.0, 1.0, 1.0), 0.5);
    }

    float diff = max(dot(normal, lightDir), 0.0);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

    vec3 ambient = ambientColor * baseColor;
    vec3 diffuse = lightColor * baseColor * diff;
    vec3 specular = lightColor * spec * 0.3;

    gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
  }
`;

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_MEMBER_COLOR = new THREE.Color(0x6b7280); // gray-500
const DEFAULT_NODE_COLOR = new THREE.Color(0x3b82f6);   // blue-500
const SELECTED_COLOR = new THREE.Color(0xfbbf24);       // amber-400
const HOVER_COLOR = new THREE.Color(0x00ffff);          // cyan
const ERROR_COLOR = new THREE.Color(0xef4444);          // red-500
const SUPPORT_COLOR = new THREE.Color(0x00cc00);        // green

/** LOD: cylinder radial segments by member count */
function getCylinderSegments(memberCount: number): number {
  if (memberCount > 50000) return 3;  // triangle
  if (memberCount > 20000) return 4;  // square
  if (memberCount > 5000) return 6;   // hexagon
  return 8;                           // octagon
}

function getSphereSegments(nodeCount: number): number {
  if (nodeCount > 50000) return 4;
  if (nodeCount > 20000) return 6;
  if (nodeCount > 5000) return 8;
  return 12;
}

// ─── Flag encoding ──────────────────────────────────────────────────

const FLAG_SELECTED = 1;
const FLAG_HOVERED  = 2;
const FLAG_ERROR    = 4; // members: error, nodes: restrained

// ─── Components ─────────────────────────────────────────────────────

/**
 * GPU-instanced member renderer: single draw call for ALL members.
 */
export const InstancedMemberShaderRenderer: React.FC<{
  memberRadius?: number;
}> = ({ memberRadius = 0.05 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const endAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const flagsAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);

  const [hoveredInstanceId, setHoveredInstanceId] = useState<number | null>(null);

  const { members, nodes, selectedIds, errorElementIds } = useModelStore(
    useShallow((state) => ({
      members: state.members,
      nodes: state.nodes,
      selectedIds: state.selectedIds,
      errorElementIds: state.errorElementIds,
    }))
  );
  const selectMember = useModelStore((s) => s.selectMember);

  const { raycaster } = useThree();

  // ── Stable member ordering ──
  const memberEntries = useMemo(() => {
    if (!members || members.size === 0) return [];
    return Array.from(members.entries());
  }, [members]);

  const memberCount = memberEntries.length;

  const idToIndex = useMemo(() => {
    const map = new Map<string, number>();
    memberEntries.forEach(([id], i) => map.set(id, i));
    return map;
  }, [memberEntries]);

  // ── LOD geometry ──
  const segments = useMemo(() => getCylinderSegments(memberCount), [memberCount]);

  const geometry = useMemo(() => {
    // Unit cylinder along Y from 0 to 1, radius 1
    const geo = new THREE.CylinderGeometry(1, 1, 1, segments, 1, false);
    // Shift so bottom is at y=0, top at y=1 (default is centered at origin)
    geo.translate(0, 0.5, 0);
    return geo;
  }, [segments]);

  // ── Shader material ──
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: MEMBER_VERTEX_SHADER,
      fragmentShader: MEMBER_FRAGMENT_SHADER,
      uniforms: {
        memberRadius: { value: memberRadius },
        selectedPulse: { value: 1.0 },
        ambientColor: { value: new THREE.Color(0.15, 0.15, 0.18) },
        lightDir: { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() },
        lightColor: { value: new THREE.Color(1.0, 0.98, 0.95) },
        cameraPosition: { value: new THREE.Vector3() },
      },
      side: THREE.DoubleSide,
    });
  }, [memberRadius]);

  // ── Build instance attributes ──
  useEffect(() => {
    if (!meshRef.current || memberCount === 0) return;
    const mesh = meshRef.current;

    // Allocate per-instance buffers
    const startArr = new Float32Array(memberCount * 3);
    const endArr = new Float32Array(memberCount * 3);
    const colorArr = new Float32Array(memberCount * 3);
    const flagsArr = new Float32Array(memberCount);

    for (let i = 0; i < memberCount; i++) {
      const [id, member] = memberEntries[i];
      const startNode = nodes.get(member.startNodeId);
      const endNode = nodes.get(member.endNodeId);

      if (!startNode || !endNode) {
        // Degenerate — place at origin with zero length
        startArr[i * 3] = 0; startArr[i * 3 + 1] = 0; startArr[i * 3 + 2] = 0;
        endArr[i * 3] = 0; endArr[i * 3 + 1] = 0; endArr[i * 3 + 2] = 0;
      } else {
        startArr[i * 3] = startNode.x;
        startArr[i * 3 + 1] = startNode.y;
        startArr[i * 3 + 2] = startNode.z;
        endArr[i * 3] = endNode.x;
        endArr[i * 3 + 1] = endNode.y;
        endArr[i * 3 + 2] = endNode.z;
      }

      // Default color
      colorArr[i * 3] = DEFAULT_MEMBER_COLOR.r;
      colorArr[i * 3 + 1] = DEFAULT_MEMBER_COLOR.g;
      colorArr[i * 3 + 2] = DEFAULT_MEMBER_COLOR.b;

      // Flags
      let flags = 0;
      if (selectedIds.has(id)) flags |= FLAG_SELECTED;
      if (errorElementIds.has(id)) flags |= FLAG_ERROR;
      flagsArr[i] = flags;
    }

    // Set identity instanceMatrix (the shader handles transforms)
    const identity = new THREE.Matrix4();
    for (let i = 0; i < memberCount; i++) {
      mesh.setMatrixAt(i, identity);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = memberCount;

    // Create InstancedBufferAttributes
    const startAttr = new THREE.InstancedBufferAttribute(startArr, 3);
    const endAttr = new THREE.InstancedBufferAttribute(endArr, 3);
    const colorAttr = new THREE.InstancedBufferAttribute(colorArr, 3);
    const flagsAttr = new THREE.InstancedBufferAttribute(flagsArr, 1);

    mesh.geometry.setAttribute('instanceStart', startAttr);
    mesh.geometry.setAttribute('instanceEnd', endAttr);
    mesh.geometry.setAttribute('instanceColor', colorAttr);
    mesh.geometry.setAttribute('instanceFlags', flagsAttr);

    startAttrRef.current = startAttr;
    endAttrRef.current = endAttr;
    colorAttrRef.current = colorAttr;
    flagsAttrRef.current = flagsAttr;

    return () => {
      mesh.geometry.deleteAttribute('instanceStart');
      mesh.geometry.deleteAttribute('instanceEnd');
      mesh.geometry.deleteAttribute('instanceColor');
      mesh.geometry.deleteAttribute('instanceFlags');
    };
  }, [memberEntries, memberCount, nodes, selectedIds, errorElementIds]);

  // ── Incremental color/flag update on selection change ──
  useEffect(() => {
    if (!flagsAttrRef.current || !colorAttrRef.current) return;

    const flagsArr = flagsAttrRef.current.array as Float32Array;
    const colorArr = colorAttrRef.current.array as Float32Array;

    for (let i = 0; i < memberCount; i++) {
      const id = memberEntries[i][0];
      let flags = 0;
      if (selectedIds.has(id)) flags |= FLAG_SELECTED;
      if (hoveredInstanceId === i) flags |= FLAG_HOVERED;
      if (errorElementIds.has(id)) flags |= FLAG_ERROR;
      flagsArr[i] = flags;

      // Update color
      const color = selectedIds.has(id)
        ? SELECTED_COLOR
        : errorElementIds.has(id)
          ? ERROR_COLOR
          : DEFAULT_MEMBER_COLOR;
      colorArr[i * 3] = color.r;
      colorArr[i * 3 + 1] = color.g;
      colorArr[i * 3 + 2] = color.b;
    }

    flagsAttrRef.current.needsUpdate = true;
    colorAttrRef.current.needsUpdate = true;
  }, [selectedIds, errorElementIds, hoveredInstanceId, memberCount, memberEntries]);

  // ── Animate selection pulse + update camera uniform ──
  useFrame(({ clock, camera }) => {
    if (!shaderMaterial) return;
    shaderMaterial.uniforms.selectedPulse.value =
      Math.sin(clock.getElapsedTime() * 3.0) * 0.5 + 0.5;
    shaderMaterial.uniforms.cameraPosition.value.copy(camera.position);
  });

  // ── Raycasting ──
  const hoverRafRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
  }, []);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!meshRef.current) return;
    event.stopPropagation();
    if (hoverRafRef.current !== null) return;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      const mesh = meshRef.current;
      if (!mesh) return;
      const intersects = raycaster.intersectObject(mesh);
      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        setHoveredInstanceId(intersects[0].instanceId);
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredInstanceId(null);
        document.body.style.cursor = 'default';
      }
    });
  }, [raycaster]);

  const handlePointerLeave = useCallback(() => {
    setHoveredInstanceId(null);
    document.body.style.cursor = 'default';
  }, []);

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!meshRef.current) return;
    event.stopPropagation();
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const idx = intersects[0].instanceId;
      if (idx < memberEntries.length) {
        const memberId = memberEntries[idx][0];
        const multi = event.shiftKey || event.ctrlKey || event.metaKey;
        selectMember(memberId, multi);
      }
    }
  }, [raycaster, memberEntries, selectMember]);

  if (memberCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, shaderMaterial, memberCount]}
      frustumCulled={false}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    />
  );
};

/**
 * GPU-instanced node renderer: single draw call for ALL nodes.
 */
export const InstancedNodeShaderRenderer: React.FC<{
  nodeRadius?: number;
}> = ({ nodeRadius = 0.12 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const posAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const flagsAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);

  const [hoveredInstanceId, setHoveredInstanceId] = useState<number | null>(null);

  const { nodes, selectedIds } = useModelStore(
    useShallow((state) => ({
      nodes: state.nodes,
      selectedIds: state.selectedIds,
    }))
  );
  const selectNode = useModelStore((s) => s.selectNode);

  const { raycaster } = useThree();

  const nodeEntries = useMemo(() => {
    if (!nodes || nodes.size === 0) return [];
    return Array.from(nodes.entries());
  }, [nodes]);

  const nodeCount = nodeEntries.length;

  const idToIndex = useMemo(() => {
    const map = new Map<string, number>();
    nodeEntries.forEach(([id], i) => map.set(id, i));
    return map;
  }, [nodeEntries]);

  const segments = useMemo(() => getSphereSegments(nodeCount), [nodeCount]);

  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(1, segments, segments);
  }, [segments]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: NODE_VERTEX_SHADER,
      fragmentShader: NODE_FRAGMENT_SHADER,
      uniforms: {
        nodeRadius: { value: nodeRadius },
        selectedPulse: { value: 1.0 },
        ambientColor: { value: new THREE.Color(0.15, 0.15, 0.18) },
        lightDir: { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() },
        lightColor: { value: new THREE.Color(1.0, 0.98, 0.95) },
        cameraPosition: { value: new THREE.Vector3() },
      },
    });
  }, [nodeRadius]);

  // ── Build instance attributes ──
  useEffect(() => {
    if (!meshRef.current || nodeCount === 0) return;
    const mesh = meshRef.current;

    const posArr = new Float32Array(nodeCount * 3);
    const colorArr = new Float32Array(nodeCount * 3);
    const flagsArr = new Float32Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
      const [id, node] = nodeEntries[i];
      posArr[i * 3] = node.x;
      posArr[i * 3 + 1] = node.y;
      posArr[i * 3 + 2] = node.z;

      colorArr[i * 3] = DEFAULT_NODE_COLOR.r;
      colorArr[i * 3 + 1] = DEFAULT_NODE_COLOR.g;
      colorArr[i * 3 + 2] = DEFAULT_NODE_COLOR.b;

      let flags = 0;
      if (selectedIds.has(id)) flags |= FLAG_SELECTED;
      if (node.restraints) {
        const r = node.restraints;
        if (r.fx || r.fy || r.fz || r.mx || r.my || r.mz) {
          flags |= FLAG_ERROR; // reuse bit 2 for "restrained" in nodes
        }
      }
      flagsArr[i] = flags;
    }

    const identity = new THREE.Matrix4();
    for (let i = 0; i < nodeCount; i++) {
      mesh.setMatrixAt(i, identity);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = nodeCount;

    const posAttr = new THREE.InstancedBufferAttribute(posArr, 3);
    const colorAttr = new THREE.InstancedBufferAttribute(colorArr, 3);
    const flagsAttr = new THREE.InstancedBufferAttribute(flagsArr, 1);

    mesh.geometry.setAttribute('instancePosition', posAttr);
    mesh.geometry.setAttribute('instanceColor', colorAttr);
    mesh.geometry.setAttribute('instanceFlags', flagsAttr);

    posAttrRef.current = posAttr;
    colorAttrRef.current = colorAttr;
    flagsAttrRef.current = flagsAttr;

    return () => {
      mesh.geometry.deleteAttribute('instancePosition');
      mesh.geometry.deleteAttribute('instanceColor');
      mesh.geometry.deleteAttribute('instanceFlags');
    };
  }, [nodeEntries, nodeCount, selectedIds]);

  // ── Incremental flag/color update ──
  useEffect(() => {
    if (!flagsAttrRef.current || !colorAttrRef.current) return;

    const flagsArr = flagsAttrRef.current.array as Float32Array;
    const colorArr = colorAttrRef.current.array as Float32Array;

    for (let i = 0; i < nodeCount; i++) {
      const [id, node] = nodeEntries[i];
      let flags = 0;
      if (selectedIds.has(id)) flags |= FLAG_SELECTED;
      if (hoveredInstanceId === i) flags |= FLAG_HOVERED;
      if (node.restraints) {
        const r = node.restraints;
        if (r.fx || r.fy || r.fz || r.mx || r.my || r.mz) {
          flags |= FLAG_ERROR;
        }
      }
      flagsArr[i] = flags;

      const color = selectedIds.has(id)
        ? SELECTED_COLOR
        : (node.restraints && (node.restraints.fx || node.restraints.fy || node.restraints.fz))
          ? SUPPORT_COLOR
          : DEFAULT_NODE_COLOR;
      colorArr[i * 3] = color.r;
      colorArr[i * 3 + 1] = color.g;
      colorArr[i * 3 + 2] = color.b;
    }

    flagsAttrRef.current.needsUpdate = true;
    colorAttrRef.current.needsUpdate = true;
  }, [selectedIds, hoveredInstanceId, nodeCount, nodeEntries]);

  // ── Animate pulse + camera ──
  useFrame(({ clock, camera }) => {
    if (!shaderMaterial) return;
    shaderMaterial.uniforms.selectedPulse.value =
      Math.sin(clock.getElapsedTime() * 3.0) * 0.5 + 0.5;
    shaderMaterial.uniforms.cameraPosition.value.copy(camera.position);
  });

  // ── Raycasting ──
  const hoverRafRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
  }, []);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!meshRef.current) return;
    event.stopPropagation();
    if (hoverRafRef.current !== null) return;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      const mesh = meshRef.current;
      if (!mesh) return;
      const intersects = raycaster.intersectObject(mesh);
      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        setHoveredInstanceId(intersects[0].instanceId);
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredInstanceId(null);
        document.body.style.cursor = 'default';
      }
    });
  }, [raycaster]);

  const handlePointerLeave = useCallback(() => {
    setHoveredInstanceId(null);
    document.body.style.cursor = 'default';
  }, []);

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!meshRef.current) return;
    event.stopPropagation();
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const idx = intersects[0].instanceId;
      if (idx < nodeEntries.length) {
        const nodeId = nodeEntries[idx][0];
        const multi = event.shiftKey || event.ctrlKey || event.metaKey;
        selectNode(nodeId, multi);
      }
    }
  }, [raycaster, nodeEntries, selectNode]);

  if (nodeCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, shaderMaterial, nodeCount]}
      frustumCulled={false}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    />
  );
};

// ─── Composite Component ────────────────────────────────────────────

export interface InstancedStructureRendererProps {
  memberRadius?: number;
  nodeRadius?: number;
  showNodes?: boolean;
  showMembers?: boolean;
}

/**
 * Combined instanced structure renderer — renders both nodes and members
 * in exactly 2 draw calls total (1 for all members, 1 for all nodes).
 *
 * Use this as a drop-in replacement for the combination of
 * InstancedMembersRenderer + InstancedNodesRenderer when member count
 * exceeds ~1000 or for consistent shader-based rendering.
 */
export const InstancedStructureRenderer: React.FC<InstancedStructureRendererProps> = ({
  memberRadius = 0.05,
  nodeRadius = 0.12,
  showNodes = true,
  showMembers = true,
}) => {
  return (
    <>
      {showMembers && <InstancedMemberShaderRenderer memberRadius={memberRadius} />}
      {showNodes && <InstancedNodeShaderRenderer nodeRadius={nodeRadius} />}
    </>
  );
};

export default InstancedStructureRenderer;
