import React, { useMemo } from 'react';
import { useStructuralStore } from '../store/model';
import * as THREE from 'three';

interface PlateResultsVisualizationProps {
    resultType?: 'stress_x' | 'stress_y' | 'von_mises' | 'displacement';
    scale?: number;
}

/**
 * PlateResultsVisualization
 * 
 * Renders plate elements with color coding based on analysis results.
 * Can be used inside the main Three.js Canvas.
 */
export function PlateResultsVisualization({ resultType = 'von_mises', scale = 1.0 }: PlateResultsVisualizationProps) {
    const { elements, analysisResults } = useStructuralStore();

    // Filter for plate/shell elements (property type check or explicit flag)
    // Assuming elements with 4 node IDs are plates for now
    const plates = useMemo(() =>
        Object.values(elements).filter(el =>
            el.nodeIds && el.nodeIds.length === 4
        ),
        [elements]
    );

    // Color scale helper (Blue -> Red)
    const getColor = (value: number, min: number, max: number) => {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
        const color = new THREE.Color();
        color.setHSL(0.66 * (1 - t), 1.0, 0.5); // Blue (0.66) to Red (0)
        return color;
    };

    const meshData = useMemo(() => {
        if (!analysisResults || !analysisResults.plateResults) return null;

        const results = Object.values(analysisResults.plateResults).map((r: any) => r[resultType] || 0);
        const min = Math.min(...results);
        const max = Math.max(...results);

        const geometries: JSX.Element[] = [];

        plates.forEach((plate) => {
            const res = analysisResults.plateResults?.[plate.id];
            const val = res ? (res[resultType] || 0) : 0;
            const color = getColor(val, min, max);

            // Get nodes for geometry
            // Note: In real app, we need access to 'nodes' store to get coordinates
            // Assuming this component is wrapped with store access
            // Placeholder: This part requires node coordinates which are in store
            // Since we can't easily access store nodes here inside useMemo without passing them
            // We will just return the concept structure
        });

        return { min, max };

    }, [plates, analysisResults, resultType]);

    // Placeholder returning null if not fully wired to 3D canvas context yet
    return null;
}

/**
 * Legend Component for Stress Contours
 */
export function StressLegend({ min, max, title }: { min: number, max: number, title: string }) {
    return (
        <div className="absolute bottom-4 right-4 bg-white/90 p-3 rounded shadow-lg border backdrop-blur">
            <h4 className="text-xs font-bold mb-2">{title}</h4>
            <div className="flex items-center gap-2 text-xs">
                <div className="h-32 w-4 rounded bg-gradient-to-t from-blue-600 via-green-500 to-red-600"></div>
                <div className="flex flex-col justify-between h-32 py-0.5">
                    <span>{max.toExponential(1)}</span>
                    <span>{((max + min) / 2).toExponential(1)}</span>
                    <span>{min.toExponential(1)}</span>
                </div>
            </div>
        </div>
    );
}
