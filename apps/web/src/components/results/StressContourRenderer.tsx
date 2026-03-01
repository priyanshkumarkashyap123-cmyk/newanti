/**
 * StressContourRenderer.tsx - Advanced Stress Contour Visualization
 * 
 * Features:
 * - Smooth continuous color contours using shaders
 * - Multiple stress types (von Mises, principal, axial, combined)
 * - Customizable contour intervals
 * - Interactive legend with clickable ranges
 * - Smooth transitions between stress views
 * - Threshold highlighting for critical areas
 */

import React, { FC, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
    Activity,
    AlertTriangle,
    ChevronDown,
    Layers,
    Maximize2,
    Settings,
    Eye,
    EyeOff
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type StressType = 
    | 'vonMises' 
    | 'principal1' 
    | 'principal2' 
    | 'principal3'
    | 'axial'
    | 'bending'
    | 'shear'
    | 'combined'
    | 'utilization';

export interface MemberStressData {
    id: string;
    startNodeId: string;
    endNodeId: string;
    stressProfile: StressPoint[];  // Stress values along member length
    maxStress: number;
    minStress: number;
    criticalLocation: number;  // 0-1 position of max stress
    capacity: number;
    utilization: number;
}

export interface StressPoint {
    position: number;  // 0-1 along member
    vonMises: number;
    principal1: number;
    principal2: number;
    principal3: number;
    axial: number;
    bending: number;
    shear: number;
}

export interface NodePosition {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface StressContourProps {
    nodes: NodePosition[];
    memberStress: MemberStressData[];
    stressType: StressType;
    onStressTypeChange: (type: StressType) => void;
    allowableStress?: number;
    showContourLines?: boolean;
    contourIntervals?: number;
    highlightCritical?: boolean;
    onMemberClick?: (memberId: string, stressValue: number) => void;
}

// ============================================
// CONSTANTS
// ============================================

const STRESS_TYPES: Array<{ id: StressType; label: string; description: string }> = [
    { id: 'vonMises', label: 'Von Mises', description: 'Combined stress (yield criterion)' },
    { id: 'principal1', label: 'Principal σ₁', description: 'Maximum principal stress' },
    { id: 'principal2', label: 'Principal σ₂', description: 'Intermediate principal stress' },
    { id: 'principal3', label: 'Principal σ₃', description: 'Minimum principal stress' },
    { id: 'axial', label: 'Axial', description: 'Axial (normal) stress' },
    { id: 'bending', label: 'Bending', description: 'Bending stress' },
    { id: 'shear', label: 'Shear', description: 'Shear stress' },
    { id: 'combined', label: 'Combined', description: 'Combined axial + bending' },
    { id: 'utilization', label: 'Utilization', description: 'Stress/Capacity ratio' }
];

// Professional engineering color scale (similar to FEA software)
const CONTOUR_COLORS = [
    { value: 0.0, color: new THREE.Color('#0000ff') },   // Blue - minimum
    { value: 0.1, color: new THREE.Color('#0066ff') },
    { value: 0.2, color: new THREE.Color('#00ccff') },   // Cyan
    { value: 0.3, color: new THREE.Color('#00ffcc') },
    { value: 0.4, color: new THREE.Color('#00ff66') },   // Green
    { value: 0.5, color: new THREE.Color('#66ff00') },   // Yellow-green
    { value: 0.6, color: new THREE.Color('#ccff00') },
    { value: 0.7, color: new THREE.Color('#ffcc00') },   // Orange
    { value: 0.8, color: new THREE.Color('#ff6600') },
    { value: 0.9, color: new THREE.Color('#ff0000') },   // Red
    { value: 1.0, color: new THREE.Color('#cc0000') }    // Dark red - maximum
];

const DEFAULT_CONTOUR_INTERVALS = 10;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Interpolate color from contour scale
 */
function getContourColor(normalizedValue: number): THREE.Color {
    const t = Math.max(0, Math.min(1, normalizedValue));
    
    // Find bracketing colors
    let i = 0;
    for (; i < CONTOUR_COLORS.length - 1; i++) {
        if (t <= CONTOUR_COLORS[i + 1]!.value) break;
    }
    
    const c1 = CONTOUR_COLORS[i]!;
    const c2 = CONTOUR_COLORS[Math.min(i + 1, CONTOUR_COLORS.length - 1)]!;
    
    const localT = c2.value > c1.value 
        ? (t - c1.value) / (c2.value - c1.value) 
        : 0;
    
    return c1.color.clone().lerp(c2.color, localT);
}

/**
 * Get stress value based on type
 */
function getStressValue(point: StressPoint, type: StressType): number {
    switch (type) {
        case 'vonMises': return point.vonMises;
        case 'principal1': return point.principal1;
        case 'principal2': return point.principal2;
        case 'principal3': return point.principal3;
        case 'axial': return point.axial;
        case 'bending': return point.bending;
        case 'shear': return point.shear;
        case 'combined': return Math.abs(point.axial) + Math.abs(point.bending);
        case 'utilization': return point.vonMises; // Will be normalized by capacity
        default: return point.vonMises;
    }
}

// ============================================
// STRESS MEMBER 3D COMPONENT
// ============================================

interface StressMemberProps {
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    stressProfile: StressPoint[];
    stressType: StressType;
    minStress: number;
    maxStress: number;
    capacity: number;
    isCritical: boolean;
    showContourLines: boolean;
    contourIntervals: number;
    memberId: string;
    onClick?: () => void;
}

const StressMember: FC<StressMemberProps> = ({
    startPos,
    endPos,
    stressProfile,
    stressType,
    minStress,
    maxStress,
    capacity,
    isCritical,
    showContourLines,
    contourIntervals,
    memberId,
    onClick
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    
    // Create tube geometry with color gradient
    const { geometry, colors, maxStressLocation } = useMemo(() => {
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const length = direction.length();
        direction.normalize();
        
        // Sample points along member
        const numSegments = Math.max(stressProfile.length - 1, 10);
        const points: THREE.Vector3[] = [];
        const colorValues: THREE.Color[] = [];
        let maxLoc = 0;
        let maxVal = -Infinity;
        
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const point = startPos.clone().addScaledVector(direction, t * length);
            points.push(point);
            
            // Interpolate stress from profile
            const profileIdx = t * (stressProfile.length - 1);
            const idx1 = Math.floor(profileIdx);
            const idx2 = Math.min(idx1 + 1, stressProfile.length - 1);
            const localT = profileIdx - idx1;
            
            const stress1 = stressProfile[idx1] ? getStressValue(stressProfile[idx1], stressType) : 0;
            const stress2 = stressProfile[idx2] ? getStressValue(stressProfile[idx2], stressType) : 0;
            const stress = stress1 + localT * (stress2 - stress1);
            
            // Track max location
            if (stress > maxVal) {
                maxVal = stress;
                maxLoc = t;
            }
            
            // Normalize and get color
            const normalizer = stressType === 'utilization' ? capacity : maxStress;
            const normalized = normalizer > 0 ? Math.abs(stress) / normalizer : 0;
            colorValues.push(getContourColor(normalized));
        }
        
        // Create tube geometry
        const path = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(path, numSegments, 0.03, 8, false);
        
        // Apply vertex colors
        const colorsArray = new Float32Array(tubeGeo.attributes.position.count * 3);
        const positionCount = tubeGeo.attributes.position.count;
        const segmentVertices = positionCount / (numSegments + 1);
        
        for (let i = 0; i <= numSegments; i++) {
            const color = colorValues[i]!;
            for (let j = 0; j < segmentVertices; j++) {
                const idx = (i * segmentVertices + j) * 3;
                if (idx + 2 < colorsArray.length) {
                    colorsArray[idx] = color.r;
                    colorsArray[idx + 1] = color.g;
                    colorsArray[idx + 2] = color.b;
                }
            }
        }
        
        tubeGeo.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
        
        return { geometry: tubeGeo, colors: colorValues, maxStressLocation: maxLoc };
    }, [startPos, endPos, stressProfile, stressType, maxStress, capacity]);
    
    // Pulse animation for critical members
    useFrame((_, delta) => {
        if (isCritical && meshRef.current) {
            const material = meshRef.current.material as THREE.MeshStandardMaterial;
            const pulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.005);
            material.emissiveIntensity = pulse;
        }
    });
    
    return (
        <group>
            <mesh
                ref={meshRef}
                geometry={geometry}
                onClick={onClick}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            >
                <meshStandardMaterial
                    vertexColors
                    emissive={isCritical ? new THREE.Color('#ff0000') : new THREE.Color('#000000')}
                    emissiveIntensity={isCritical ? 0.3 : 0}
                    roughness={0.6}
                    metalness={0.2}
                />
            </mesh>
            
            {/* Critical marker at max stress location */}
            {isCritical && (
                <Html
                    position={startPos.clone().lerp(endPos, maxStressLocation).toArray()}
                    center
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                        <AlertTriangle size={12} />
                        Critical
                    </div>
                </Html>
            )}
            
            {/* Hover info */}
            {hovered && (
                <Html
                    position={startPos.clone().lerp(endPos, 0.5).toArray()}
                    center
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="bg-black/90 text-slate-900 dark:text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        <div className="font-bold">{memberId}</div>
                        <div>Max: {maxStress.toFixed(1)} MPa</div>
                        <div>Util: {((maxStress / capacity) * 100).toFixed(1)}%</div>
                    </div>
                </Html>
            )}
        </group>
    );
};

// ============================================
// COLOR LEGEND COMPONENT
// ============================================

interface ColorLegendProps {
    minValue: number;
    maxValue: number;
    unit: string;
    contourIntervals: number;
    stressType: StressType;
    allowableStress?: number;
}

const ColorLegend: FC<ColorLegendProps> = ({
    minValue,
    maxValue,
    unit,
    contourIntervals,
    stressType,
    allowableStress
}) => {
    const intervals = useMemo(() => {
        const result = [];
        for (let i = 0; i <= contourIntervals; i++) {
            const t = i / contourIntervals;
            const value = minValue + t * (maxValue - minValue);
            const color = getContourColor(t);
            result.push({ t, value, color: `#${color.getHexString()}` });
        }
        return result;
    }, [minValue, maxValue, contourIntervals]);
    
    return (
        <div className="bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur rounded-lg p-3 min-w-[180px]">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
                <Activity size={12} />
                {STRESS_TYPES.find(s => s.id === stressType)?.label || 'Stress'}
            </div>
            
            {/* Color bar */}
            <div className="flex gap-1 mb-2">
                <div 
                    className="w-4 rounded overflow-hidden"
                    style={{
                        background: `linear-gradient(to bottom, ${intervals.map(i => i.color).reverse().join(', ')})`
                    }}
                />
                
                {/* Values */}
                <div className="flex-1 flex flex-col justify-between text-right">
                    {intervals.filter((_, i) => i % 2 === 0).reverse().map((interval, idx) => (
                        <div key={idx} className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {interval.value.toFixed(1)} {unit}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Allowable stress line */}
            {allowableStress && allowableStress >= minValue && allowableStress <= maxValue && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-0.5 bg-red-500" />
                        <span className="text-slate-500 dark:text-slate-400">
                            Allowable: <span className="text-red-400 font-mono">{allowableStress} {unit}</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// STRESS TYPE SELECTOR
// ============================================

interface StressTypeSelectorProps {
    selected: StressType;
    onChange: (type: StressType) => void;
}

export const StressTypeSelector: FC<StressTypeSelectorProps> = ({ selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const selectedInfo = STRESS_TYPES.find(s => s.id === selected);
    
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 
                         rounded-lg text-sm transition-colors border border-slate-600"
            >
                <Layers size={14} className="text-cyan-400" />
                <span className="text-slate-700 dark:text-slate-200">{selectedInfo?.label}</span>
                <ChevronDown size={14} className={`text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute left-0 top-full mt-1 w-64 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 
                                     rounded-lg shadow-xl z-50 overflow-hidden"
                        >
                            {STRESS_TYPES.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        onChange(type.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors
                                              ${selected === type.id 
                                                ? 'bg-cyan-600/20 text-cyan-400' 
                                                : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'
                                              }`}
                                >
                                    <div className="mt-0.5">
                                        {selected === type.id ? (
                                            <Eye size={14} className="text-cyan-400" />
                                        ) : (
                                            <EyeOff size={14} className="text-slate-500 dark:text-slate-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">{type.label}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{type.description}</div>
                                    </div>
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// MAIN STRESS CONTOUR COMPONENT (3D)
// ============================================

export const StressContourRenderer: FC<StressContourProps> = ({
    nodes,
    memberStress,
    stressType,
    onStressTypeChange,
    allowableStress = 250,
    showContourLines = true,
    contourIntervals = DEFAULT_CONTOUR_INTERVALS,
    highlightCritical = true,
    onMemberClick
}) => {
    // Create node position map
    const nodeMap = useMemo(() => {
        const map = new Map<string, THREE.Vector3>();
        for (const node of nodes) {
            map.set(node.id, new THREE.Vector3(node.x, node.y, node.z));
        }
        return map;
    }, [nodes]);
    
    // Calculate global min/max for color scaling
    const { globalMin, globalMax, criticalMembers } = useMemo(() => {
        let min = Infinity;
        let max = -Infinity;
        const critical: string[] = [];
        
        for (const member of memberStress) {
            for (const point of member.stressProfile) {
                const value = getStressValue(point, stressType);
                min = Math.min(min, value);
                max = Math.max(max, Math.abs(value));
            }
            
            if (member.utilization > 1.0) {
                critical.push(member.id);
            }
        }
        
        return { globalMin: min, globalMax: max, criticalMembers: critical };
    }, [memberStress, stressType]);
    
    return (
        <group name="stress-contours">
            {memberStress.map((member) => {
                const startPos = nodeMap.get(member.startNodeId);
                const endPos = nodeMap.get(member.endNodeId);
                
                if (!startPos || !endPos) return null;
                
                const isCritical = highlightCritical && member.utilization > 1.0;
                
                return (
                    <StressMember
                        key={member.id}
                        startPos={startPos}
                        endPos={endPos}
                        stressProfile={member.stressProfile}
                        stressType={stressType}
                        minStress={globalMin}
                        maxStress={globalMax}
                        capacity={member.capacity}
                        isCritical={isCritical}
                        showContourLines={showContourLines}
                        contourIntervals={contourIntervals}
                        memberId={member.id}
                        onClick={() => onMemberClick?.(member.id, member.maxStress)}
                    />
                );
            })}

            {/* ─── FLOATING LEGEND & CONTROLS (Html overlay inside R3F) ─── */}
            <Html
                position={[0, 0, 0]}
                center
                style={{ pointerEvents: 'none' }}
                zIndexRange={[100, 0]}
            >
                {/* Right-side color legend */}
                <div style={{
                    position: 'fixed',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'auto',
                    zIndex: 99,
                }}>
                    <div className="bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-300/60 dark:border-slate-700/60 shadow-2xl p-3 w-[200px]">
                        {/* Stress type selector */}
                        <div className="mb-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Stress Type</div>
                            <select
                                value={stressType}
                                onChange={(e) => onStressTypeChange(e.target.value as StressType)}
                                className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-600 text-slate-700 dark:text-slate-200 rounded-md px-2 py-1.5 cursor-pointer focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                            >
                                {STRESS_TYPES.map(st => (
                                    <option key={st.id} value={st.id}>{st.label} — {st.description}</option>
                                ))}
                            </select>
                        </div>

                        {/* Color bar + scale */}
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
                            {STRESS_TYPES.find(s => s.id === stressType)?.label || 'Stress'} Scale
                        </div>
                        <div className="flex gap-2 items-stretch">
                            <div
                                className="w-5 rounded-sm overflow-hidden flex-shrink-0"
                                style={{
                                    background: `linear-gradient(to bottom, ${
                                        Array.from({ length: 11 }, (_, i) => {
                                            const t = 1 - i / 10;
                                            return `#${getContourColor(t).getHexString()}`;
                                        }).join(', ')
                                    })`,
                                    minHeight: 120,
                                }}
                            />
                            <div className="flex flex-col justify-between text-right flex-1">
                                {Array.from({ length: 6 }, (_, i) => {
                                    const t = 1 - i / 5;
                                    const val = stressType === 'utilization'
                                        ? t * 100
                                        : globalMin + t * (globalMax - globalMin);
                                    const unit = stressType === 'utilization' ? '%' : 'MPa';
                                    return (
                                        <div key={i} className="text-[10px] font-mono text-slate-600 dark:text-slate-300 leading-tight">
                                            {val.toFixed(stressType === 'utilization' ? 0 : 1)} {unit}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Summary statistics */}
                        <div className="mt-3 pt-2 border-t border-slate-300/60 dark:border-slate-700/60 space-y-1">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500 dark:text-slate-400">Members</span>
                                <span className="text-slate-700 dark:text-slate-200 font-mono">{memberStress.length}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500 dark:text-slate-400">Max Stress</span>
                                <span className="text-red-400 font-mono font-semibold">{globalMax.toFixed(1)} MPa</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-500 dark:text-slate-400">Critical ({'>'} 100%)</span>
                                <span className={`font-mono font-semibold ${criticalMembers.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {criticalMembers.length}
                                </span>
                            </div>
                            {allowableStress > 0 && (
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-500 dark:text-slate-400">f_y (yield)</span>
                                    <span className="text-cyan-400 font-mono">{allowableStress} MPa</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom-center: peak-value badges for top 5 most stressed members */}
                {/* (kept small so viewport isn't cluttered) */}
            </Html>

            {/* ─── Peak-value labels at midpoint of each member ─── */}
            {memberStress.map((member) => {
                const startPos = nodeMap.get(member.startNodeId);
                const endPos = nodeMap.get(member.endNodeId);
                if (!startPos || !endPos) return null;

                const labelPos = startPos.clone().lerp(endPos, member.criticalLocation);
                // Offset upward slightly so label doesn't overlap the tube
                labelPos.y += 0.12;

                const stressVal = member.maxStress;
                const util = member.utilization;
                // Show labels only for non-trivial members (stress > 0.5 MPa)
                if (stressVal < 0.5) return null;

                // Color logic: green < 60%, yellow 60-90%, red > 90%
                const labelColor = util > 0.9 ? '#ef4444' : util > 0.6 ? '#eab308' : '#22c55e';
                const bgColor = util > 0.9 ? 'rgba(239,68,68,0.15)' : util > 0.6 ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)';

                return (
                    <Html
                        key={`label-${member.id}`}
                        position={labelPos.toArray()}
                        center
                        style={{ pointerEvents: 'none' }}
                    >
                        <div style={{
                            background: bgColor,
                            border: `1px solid ${labelColor}`,
                            borderRadius: 4,
                            padding: '1px 5px',
                            color: labelColor,
                            fontSize: 10,
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            backdropFilter: 'blur(4px)',
                            lineHeight: 1.6,
                            textAlign: 'center',
                        }}>
                            {stressVal.toFixed(1)} MPa
                            <span style={{ opacity: 0.7, marginLeft: 4 }}>
                                ({(util * 100).toFixed(0)}%)
                            </span>
                        </div>
                    </Html>
                );
            })}
        </group>
    );
};

// ============================================
// STRESS CONTOUR PANEL (UI CONTROLS)
// ============================================

interface StressContourPanelProps {
    stressType: StressType;
    onStressTypeChange: (type: StressType) => void;
    showContours: boolean;
    onShowContoursChange: (show: boolean) => void;
    highlightCritical: boolean;
    onHighlightCriticalChange: (highlight: boolean) => void;
    contourIntervals: number;
    onContourIntervalsChange: (intervals: number) => void;
    minStress: number;
    maxStress: number;
    criticalCount: number;
    totalMembers: number;
}

export const StressContourPanel: FC<StressContourPanelProps> = ({
    stressType,
    onStressTypeChange,
    showContours,
    onShowContoursChange,
    highlightCritical,
    onHighlightCriticalChange,
    contourIntervals,
    onContourIntervalsChange,
    minStress,
    maxStress,
    criticalCount,
    totalMembers
}) => {
    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-500" />
                    Stress Contours
                </h3>
                
                <StressTypeSelector selected={stressType} onChange={onStressTypeChange} />
            </div>
            
            {/* Settings */}
            <div className="p-4 space-y-4">
                {/* Legend */}
                <ColorLegend
                    minValue={minStress}
                    maxValue={maxStress}
                    unit="MPa"
                    contourIntervals={contourIntervals}
                    stressType={stressType}
                />
                
                {/* Controls */}
                <div className="space-y-3">
                    {/* Contour intervals */}
                    <div>
                        <label className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span>Contour Intervals</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300">{contourIntervals}</span>
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="20"
                            value={contourIntervals}
                            onChange={(e) => onContourIntervalsChange(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    
                    {/* Toggle options */}
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showContours}
                                onChange={(e) => onShowContoursChange(e.target.checked)}
                                className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                            />
                            Show Contour Lines
                        </label>
                        
                        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={highlightCritical}
                                onChange={(e) => onHighlightCriticalChange(e.target.checked)}
                                className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                            />
                            Highlight Critical Members
                        </label>
                    </div>
                </div>
                
                {/* Summary */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Stress Range</div>
                        <div className="text-sm font-mono">
                            <span className="text-blue-400">{minStress.toFixed(1)}</span>
                            <span className="text-slate-500 dark:text-slate-400"> → </span>
                            <span className="text-red-400">{maxStress.toFixed(1)}</span>
                            <span className="text-slate-500 dark:text-slate-400"> MPa</span>
                        </div>
                    </div>
                    
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Critical Members</div>
                        <div className={`text-sm font-bold ${criticalCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {criticalCount} / {totalMembers}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StressContourRenderer;
