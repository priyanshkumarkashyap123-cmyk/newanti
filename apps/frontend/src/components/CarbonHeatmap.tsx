/**
 * CarbonHeatmap - 3D Visualization of Carbon Intensity
 * 
 * Renders structural members with color intensity based on their
 * embodied carbon contribution. Darker = higher carbon.
 */

import { FC, useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';

// ============================================
// TYPES
// ============================================

export interface MemberCarbonData {
    memberId: string;
    startX: number;
    startY: number;
    startZ: number;
    endX: number;
    endY: number;
    endZ: number;
    embodiedCarbon: number; // kgCO2e
    carbonIntensity: number; // normalized 0-1
    materialType: string;
}

export type SustainabilityRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

interface CarbonHeatmapProps {
    members: MemberCarbonData[];
    showLabels?: boolean;
    lineThickness?: number;
}

interface SustainabilityGaugeProps {
    rating: SustainabilityRating;
    totalCO2e: number;
    buildingIntensity?: number;
    className?: string;
}

// ============================================
// CARBON HEATMAP (3D)
// ============================================

export const CarbonHeatmap: FC<CarbonHeatmapProps> = ({
    members,
    showLabels = false,
    lineThickness = 4
}) => {
    // Calculate max carbon for normalization
    const maxCarbon = useMemo(() => {
        return Math.max(...members.map(m => m.embodiedCarbon), 1);
    }, [members]);

    return (
        <group name="carbon-heatmap">
            {members.map((member) => {
                const start = new THREE.Vector3(member.startX, member.startY, member.startZ);
                const end = new THREE.Vector3(member.endX, member.endY, member.endZ);
                const midpoint = new THREE.Vector3().lerpVectors(start, end, 0.5);

                // Calculate color based on carbon intensity
                const intensity = member.carbonIntensity ?? (member.embodiedCarbon / maxCarbon);
                const color = getIntensityColor(intensity);

                return (
                    <group key={member.memberId}>
                        {/* Member line with carbon-based color */}
                        <Line
                            points={[start, end]}
                            color={color}
                            lineWidth={lineThickness}
                        />

                        {/* Optional label showing carbon value */}
                        {showLabels && (
                            <Html
                                position={midpoint}
                                center
                                distanceFactor={15}
                                style={{ pointerEvents: 'none' }}
                            >
                                <div
                                    style={{
                                        backgroundColor: 'rgba(0,0,0,0.8)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontFamily: 'monospace',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {member.embodiedCarbon.toFixed(1)} kgCO₂e
                                </div>
                            </Html>
                        )}
                    </group>
                );
            })}
        </group>
    );
};

// ============================================
// SUSTAINABILITY GAUGE (2D Dashboard)
// ============================================

export const SustainabilityGauge: FC<SustainabilityGaugeProps> = ({
    rating,
    totalCO2e,
    buildingIntensity,
    className = ''
}) => {
    const ratingColors: Record<SustainabilityRating, string> = {
        'A': '#22C55E',
        'B': '#84CC16',
        'C': '#EAB308',
        'D': '#F97316',
        'E': '#EF4444',
        'F': '#991B1B'
    };

    const ratingDescriptions: Record<SustainabilityRating, string> = {
        'A': 'Excellent',
        'B': 'Good',
        'C': 'Average',
        'D': 'Below Average',
        'E': 'Poor',
        'F': 'Very Poor'
    };

    const ratings: SustainabilityRating[] = ['A', 'B', 'C', 'D', 'E', 'F'];
    const ratingIndex = ratings.indexOf(rating);

    return (
        <div className={`bg-[#131b2e] rounded-xl p-5 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#dae2fd] font-semibold text-lg">Sustainability Rating</h3>
                <div
                    className="text-3xl font-bold px-4 py-1 rounded-lg"
                    style={{
                        backgroundColor: ratingColors[rating],
                        color: rating === 'C' || rating === 'D' ? '#1A1A1A' : 'white'
                    }}
                >
                    {rating}
                </div>
            </div>

            {/* Rating bar */}
            <div className="flex gap-1 mb-4">
                {ratings.map((r, i) => (
                    <div
                        key={r}
                        className="flex-1 h-3 rounded-full transition-all duration-300"
                        style={{
                            backgroundColor: i <= ratingIndex ? ratingColors[r] : '#374151',
                            opacity: i === ratingIndex ? 1 : 0.5
                        }}
                    />
                ))}
            </div>

            {/* Description */}
            <p className="text-[#869ab8] text-sm mb-4">
                {ratingDescriptions[rating]} - {getRatingAdvice(rating)}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="text-[#869ab8] text-xs uppercase mb-1">Total Embodied Carbon</div>
                    <div className="text-[#dae2fd] font-bold text-xl">
                        {formatCO2e(totalCO2e)}
                    </div>
                </div>
                {buildingIntensity !== undefined && (
                    <div className="bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="text-[#869ab8] text-xs uppercase mb-1">Carbon Intensity</div>
                        <div className="text-[#dae2fd] font-bold text-xl">
                            {buildingIntensity.toFixed(0)} <span className="text-sm font-normal">kgCO₂e/m²</span>
                        </div>
                    </div>
                )}
            </div>

            {/* CO2 equivalent visualization */}
            <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
                <div className="text-[#869ab8] text-xs uppercase mb-2">Equivalent To</div>
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🚗</span>
                    <div>
                        <div className="text-[#dae2fd] font-semibold">
                            {formatKm(totalCO2e / 0.21)} km
                        </div>
                        <div className="text-slate-500 text-xs">driving in an average car</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CARBON BREAKDOWN CHART
// ============================================

interface CarbonBreakdownProps {
    byMaterial: Record<string, {
        totalCO2e: number;
        totalWeight: number;
        percentage: number;
    }>;
    className?: string;
}

export const CarbonBreakdown: FC<CarbonBreakdownProps> = ({
    byMaterial,
    className = ''
}) => {
    const materialColors: Record<string, string> = {
        steel: '#3B82F6',     // Blue
        concrete: '#6B7280', // Gray
        rebar: '#EF4444',    // Red
        timber: '#22C55E',   // Green
        aluminum: '#A855F7', // Purple
        masonry: '#F97316'   // Orange
    };

    const sortedMaterials = Object.entries(byMaterial)
        .sort((a, b) => b[1].percentage - a[1].percentage);

    return (
        <div className={`bg-[#131b2e] rounded-xl p-5 ${className}`}>
            <h3 className="text-[#dae2fd] font-semibold text-lg mb-4">Carbon by Material</h3>

            {/* Stacked bar */}
            <div className="h-8 rounded-lg overflow-hidden flex mb-4">
                {sortedMaterials.map(([material, data]) => (
                    <div
                        key={material}
                        style={{
                            width: `${data.percentage}%`,
                            backgroundColor: materialColors[material] || '#6B7280',
                            minWidth: data.percentage > 0 ? '4px' : '0'
                        }}
                        title={`${material}: ${data.percentage.toFixed(1)}%`}
                    />
                ))}
            </div>

            {/* Legend */}
            <div className="space-y-2">
                {sortedMaterials.map(([material, data]) => (
                    <div key={material} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: materialColors[material] || '#6B7280' }}
                            />
                            <span className="text-slate-600 dark:text-slate-300 text-sm capitalize">{material}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[#869ab8] text-sm">
                                {formatCO2e(data.totalCO2e)}
                            </span>
                            <span className="text-[#dae2fd] font-medium tracking-wide text-sm w-16 text-right">
                                {data.percentage.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get color for carbon intensity (grayscale: light to dark)
 */
function getIntensityColor(intensity: number): string {
    // Clamp intensity between 0 and 1
    const clamped = Math.max(0, Math.min(1, intensity));

    // Light gray to dark gray/black
    // intensity 0 = #C0C0C0 (192)
    // intensity 1 = #1A1A1A (26)
    const grayValue = Math.round(192 - (clamped * 166));

    return `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
}

/**
 * Get advice based on rating
 */
function getRatingAdvice(rating: SustainabilityRating): string {
    const advice: Record<SustainabilityRating, string> = {
        'A': 'Outstanding low-carbon design',
        'B': 'Better than industry average',
        'C': 'Meets typical standards',
        'D': 'Consider optimization options',
        'E': 'Significant improvements needed',
        'F': 'Major redesign recommended'
    };
    return advice[rating];
}

/**
 * Format CO2e value with appropriate units
 */
function formatCO2e(kgCO2e: number): string {
    if (kgCO2e >= 1000) {
        return `${(kgCO2e / 1000).toFixed(1)} tCO₂e`;
    }
    return `${kgCO2e.toFixed(0)} kgCO₂e`;
}

/**
 * Format kilometers
 */
function formatKm(km: number): string {
    if (km >= 1000) {
        return `${(km / 1000).toFixed(1)}k`;
    }
    return km.toFixed(0);
}

// ============================================
// CARBON LEGEND
// ============================================

interface CarbonLegendProps {
    minValue: number;
    maxValue: number;
}

export const CarbonLegend: FC<CarbonLegendProps> = ({ minValue, maxValue }) => {
    return (
        <div className="bg-slate-100/90 dark:bg-slate-800/90 rounded-lg p-3 inline-flex flex-col items-center">
            <div className="text-[#869ab8] text-xs uppercase mb-2">Carbon Intensity</div>

            {/* Gradient bar */}
            <div className="w-32 h-4 rounded"
                style={{
                    background: 'linear-gradient(to right, #C0C0C0, #1A1A1A)'
                }}
            />

            {/* Labels */}
            <div className="flex justify-between w-32 mt-1">
                <span className="text-[#869ab8] text-xs">{minValue.toFixed(0)}</span>
                <span className="text-[#869ab8] text-xs">{maxValue.toFixed(0)} kgCO₂e</span>
            </div>
        </div>
    );
};

export default CarbonHeatmap;
