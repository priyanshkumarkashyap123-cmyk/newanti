/**
 * Force Diagram Renderer
 * 
 * Renders realistic Shear Force, Bending Moment, and Axial Force diagrams
 * for structural members with professional engineering visualization.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { ForcePoint } from '../../utils/MemberForcesCalculator';

// ============================================
// TYPES
// ============================================

/** Support type at a member end */
export type SupportType = 'free' | 'pin' | 'roller' | 'fixed';

export interface MemberDiagramData {
    memberId: string;
    memberName?: string;
    length: number;
    startNode: { x: number; y: number; z: number };
    endNode: { x: number; y: number; z: number };
    forcePoints: ForcePoint[];
    maxValues: {
        shear: number;
        moment: number;
        axial: number;
        torsion?: number;
    };
    minValues: {
        shear: number;
        moment: number;
        axial: number;
        torsion?: number;
    };
    criticalPoints?: {
        maxMomentLocation: number;
        zeroShearLocation?: number;
        inflectionPoints?: number[];
    };
    /** Support condition at the start (left) end */
    startSupport?: SupportType;
    /** Support condition at the end (right) end */
    endSupport?: SupportType;
}

export interface DiagramConfig {
    showShear: boolean;
    showMoment: boolean;
    showAxial: boolean;
    showTorsion: boolean;
    showValues: boolean;
    showGrid: boolean;
    scale: number;
    colorScheme: 'engineering' | 'modern' | 'contrast';
}

interface ForceDiagramRendererProps {
    memberData: MemberDiagramData;
    config?: Partial<DiagramConfig>;
    width?: number;
    height?: number;
    onPointClick?: (point: ForcePoint, x: number) => void;
}

// ============================================
// COLOR SCHEMES
// ============================================

const COLOR_SCHEMES = {
    engineering: {
        shearPositive: '#ef4444',    // Red (per Figma §21)
        shearNegative: '#3b82f6',    // Blue
        momentPositive: '#22c55e',   // Green
        momentNegative: '#8b5cf6',   // Purple
        axialTension: '#f97316',     // Orange (tension)
        axialCompression: '#06b6d4', // Cyan (compression)
        torsion: '#a855f7',          // Purple
        member: '#1e293b',
        grid: '#e2e8f0',
        text: '#1e293b',
        background: '#FFFFFF',
    },
    modern: {
        shearPositive: '#ef4444',
        shearNegative: '#3b82f6',
        momentPositive: '#22c55e',
        momentNegative: '#8b5cf6',
        axialTension: '#f97316',
        axialCompression: '#06b6d4',
        torsion: '#a855f7',
        member: '#334155',
        grid: '#f1f5f9',
        text: '#0f172a',
        background: '#f8fafc',
    },
    contrast: {
        shearPositive: '#dc2626',
        shearNegative: '#1e40af',
        momentPositive: '#16a34a',
        momentNegative: '#7c3aed',
        axialTension: '#ea580c',
        axialCompression: '#0891b2',
        torsion: '#9333ea',
        member: '#000000',
        grid: '#cbd5e1',
        text: '#000000',
        background: '#FFFFFF',
    },
};

// ============================================
// DIAGRAM STYLES
// ============================================

const DIAGRAM_PADDING = { top: 60, right: 80, bottom: 80, left: 80 };

// ============================================
// COMPONENT
// ============================================

export const ForceDiagramRenderer: React.FC<ForceDiagramRendererProps> = ({
    memberData,
    config = {},
    width = 800,
    height = 600,
    onPointClick,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const fullConfig: DiagramConfig = useMemo(() => ({
        showShear: true,
        showMoment: true,
        showAxial: true,
        showTorsion: false,
        showValues: true,
        showGrid: true,
        scale: 1,
        colorScheme: 'engineering',
        ...config,
    }), [config]);

    const colors = COLOR_SCHEMES[fullConfig.colorScheme];
    
    // Calculate diagram dimensions
    const diagramsToShow = [
        fullConfig.showShear,
        fullConfig.showMoment,
        fullConfig.showAxial,
        fullConfig.showTorsion,
    ].filter(Boolean).length;
    
    const diagramHeight = (height - DIAGRAM_PADDING.top - DIAGRAM_PADDING.bottom) / Math.max(diagramsToShow, 1);
    const diagramWidth = width - DIAGRAM_PADDING.left - DIAGRAM_PADDING.right;

    // Render diagrams
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);
        
        // Clear canvas
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);
        
        // Draw title
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `Force Diagrams - Member ${memberData.memberName || memberData.memberId}`,
            width / 2,
            25
        );
        ctx.font = '12px Arial';
        ctx.fillText(
            `Length: ${memberData.length.toFixed(3)} m`,
            width / 2,
            42
        );
        
        let currentY = DIAGRAM_PADDING.top;
        // Draw Shear Force Diagram
        if (fullConfig.showShear) {
            drawDiagram(
                ctx,
                memberData.forcePoints,
                'Fy',
                'Shear Force (kN)',
                colors.shearPositive,
                DIAGRAM_PADDING.left,
                currentY,
                diagramWidth,
                diagramHeight - 20,
                memberData.maxValues.shear,
                memberData.minValues.shear,
                fullConfig,
                colors,
                false,
                memberData.startSupport,
                memberData.endSupport
            );
            currentY += diagramHeight;
        }
        
        // Draw Bending Moment Diagram
        if (fullConfig.showMoment) {
            drawDiagram(
                ctx,
                memberData.forcePoints,
                'Mz',
                'Bending Moment (kN·m)',
                colors.momentPositive,
                DIAGRAM_PADDING.left,
                currentY,
                diagramWidth,
                diagramHeight - 20,
                memberData.maxValues.moment,
                memberData.minValues.moment,
                fullConfig,
                colors,
                true, // Flip moment diagram (positive below axis - engineering convention)
                memberData.startSupport,
                memberData.endSupport
            );
            currentY += diagramHeight;
        }
        
        // Draw Axial Force Diagram
        if (fullConfig.showAxial) {
            drawAxialDiagram(
                ctx,
                memberData.forcePoints,
                'Fx',
                'Axial Force (kN)',
                colors.axialTension,
                colors.axialCompression,
                DIAGRAM_PADDING.left,
                currentY,
                diagramWidth,
                diagramHeight - 20,
                memberData.maxValues.axial,
                memberData.minValues.axial,
                fullConfig,
                colors,
                memberData.startSupport,
                memberData.endSupport
            );
            currentY += diagramHeight;
        }
        
        // Draw Torsion Diagram
        if (fullConfig.showTorsion && memberData.forcePoints[0]?.Tx !== undefined) {
            drawDiagram(
                ctx,
                memberData.forcePoints,
                'Tx',
                'Torsion (kN·m)',
                colors.torsion,
                DIAGRAM_PADDING.left,
                currentY,
                diagramWidth,
                diagramHeight - 20,
                memberData.maxValues.torsion || 0,
                memberData.minValues.torsion || 0,
                fullConfig,
                colors,
                false,
                memberData.startSupport,
                memberData.endSupport
            );
        }
        
    }, [memberData, fullConfig, width, height, colors]);
    
    // Handle click events
    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!onPointClick) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - DIAGRAM_PADDING.left;
        
        if (x < 0 || x > diagramWidth) return;
        
        const normalizedX = x / diagramWidth;
        const memberX = normalizedX * memberData.length;
        
        // Find closest point
        let closestPoint = memberData.forcePoints[0];
        let minDist = Infinity;
        
        for (const point of memberData.forcePoints) {
            const dist = Math.abs(point.x - memberX);
            if (dist < minDist) {
                minDist = dist;
                closestPoint = point;
            }
        }
        
        onPointClick(closestPoint, memberX);
    };
    
    return (
        <canvas
            ref={canvasRef}
            style={{ cursor: onPointClick ? 'crosshair' : 'default' }}
            onClick={handleClick}
        />
    );
};

// ============================================
// DRAWING FUNCTIONS
// ============================================

function drawDiagram(
    ctx: CanvasRenderingContext2D,
    points: ForcePoint[],
    valueKey: keyof ForcePoint,
    title: string,
    color: string,
    x: number,
    y: number,
    width: number,
    height: number,
    maxValue: number,
    minValue: number,
    config: DiagramConfig,
    colors: typeof COLOR_SCHEMES.engineering,
    flipSign: boolean = false,
    startSupport?: SupportType,
    endSupport?: SupportType
) {
    if (!points || points.length === 0) {
        // No data available for this diagram - show baseline title only
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${title} (No data)`, x, y - 5);
        return;
    }

    const centerY = y + height / 2;
    const scale = Math.max(Math.abs(maxValue), Math.abs(minValue));
    const valueScale = scale > 0 ? (height / 2 - 10) / scale : 1;
    const totalLength = Math.max(points[points.length - 1]?.x || 0, 1e-9);
    
    // Draw grid
    if (config.showGrid) {
        drawGrid(ctx, x, y, width, height, colors.grid, scale);
    }
    
    // Draw member axis (baseline)
    ctx.strokeStyle = colors.member;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, centerY);
    ctx.lineTo(x + width, centerY);
    ctx.stroke();
    
    // Draw member end supports — adapt symbol based on actual support type
    drawSupport(ctx, x, centerY, 'left', colors.member, startSupport || 'free');
    drawSupport(ctx, x + width, centerY, 'right', colors.member, endSupport || 'free');
    
    // Draw title
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, x, y - 5);
    
    // Draw diagram fill
    ctx.fillStyle = color + '40'; // 25% opacity
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(x, centerY);
    
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const px = x + (point.x / totalLength) * width;
        let value = (point[valueKey] as number) || 0;
        if (flipSign) value = -value;
        const py = centerY - value * valueScale;
        
        if (i === 0) {
            ctx.lineTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    
    // Close the path
    ctx.lineTo(x + width, centerY);
    ctx.closePath();
    ctx.fill();
    
    // Draw outline
    ctx.beginPath();
    ctx.moveTo(x, centerY);
    
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const px = x + (point.x / totalLength) * width;
        let value = (point[valueKey] as number) || 0;
        if (flipSign) value = -value;
        const py = centerY - value * valueScale;
        ctx.lineTo(px, py);
    }
    
    ctx.stroke();
    
    // Draw values at key points
    if (config.showValues) {
        drawValueLabels(ctx, points, valueKey, x, centerY, width, valueScale, colors.text, flipSign);
    }
    
    // Draw max/min value markers
    ctx.font = '10px Arial';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'right';
    if (scale > 0) {
        ctx.fillText(`+${scale.toFixed(2)}`, x - 5, y + 15);
        ctx.fillText(`-${scale.toFixed(2)}`, x - 5, y + height - 5);
    }
}

function drawAxialDiagram(
    ctx: CanvasRenderingContext2D,
    points: ForcePoint[],
    valueKey: keyof ForcePoint,
    title: string,
    tensionColor: string,
    compressionColor: string,
    x: number,
    y: number,
    width: number,
    height: number,
    maxValue: number,
    minValue: number,
    config: DiagramConfig,
    colors: typeof COLOR_SCHEMES.engineering,
    startSupport?: SupportType,
    endSupport?: SupportType
) {
    if (!points || points.length === 0) {
        // No data available for this diagram - show baseline title only
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${title} (No data)`, x, y - 5);
        return;
    }

    const centerY = y + height / 2;
    const scale = Math.max(Math.abs(maxValue), Math.abs(minValue));
    const valueScale = scale > 0 ? (height / 2 - 10) / scale : 1;
    const totalLength = Math.max(points[points.length - 1]?.x || 0, 1e-9);
    
    // Draw grid
    if (config.showGrid) {
        drawGrid(ctx, x, y, width, height, colors.grid, scale);
    }
    
    // Draw member axis
    ctx.strokeStyle = colors.member;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, centerY);
    ctx.lineTo(x + width, centerY);
    ctx.stroke();
    
    // Draw supports — adapt symbol based on actual support type
    drawSupport(ctx, x, centerY, 'left', colors.member, startSupport || 'free');
    drawSupport(ctx, x + width, centerY, 'right', colors.member, endSupport || 'free');
    
    // Draw title
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, x, y - 5);
    
    // Draw axial force with tension/compression colors
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        const x1 = x + (p1.x / totalLength) * width;
        const x2 = x + (p2.x / totalLength) * width;
        const v1 = (p1[valueKey] as number) || 0;
        const v2 = (p2[valueKey] as number) || 0;
        
        const y1 = centerY - v1 * valueScale;
        const y2 = centerY - v2 * valueScale;
        
        // Use tension or compression color
        const avgValue = (v1 + v2) / 2;
        const color = avgValue >= 0 ? tensionColor : compressionColor;
        
        ctx.fillStyle = color + '40';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(x1, centerY);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, centerY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    // Draw legend
    ctx.font = '10px Arial';
    ctx.fillStyle = tensionColor;
    ctx.textAlign = 'left';
    ctx.fillText('● Tension (+)', x + width - 120, y - 5);
    ctx.fillStyle = compressionColor;
    ctx.fillText('● Compression (-)', x + width - 50, y - 5);
    
    // Draw values
    if (config.showValues) {
        drawValueLabels(ctx, points, valueKey, x, centerY, width, valueScale, colors.text, false);
    }
    
    // Draw scale
    ctx.font = '10px Arial';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'right';
    if (scale > 0) {
        ctx.fillText(`+${scale.toFixed(2)}`, x - 5, y + 15);
        ctx.fillText(`-${scale.toFixed(2)}`, x - 5, y + height - 5);
    }
}

function drawGrid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    scale: number
) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    
    // Horizontal grid lines
    const numHLines = 4;
    for (let i = 0; i <= numHLines; i++) {
        const ly = y + (i * height) / numHLines;
        ctx.beginPath();
        ctx.moveTo(x, ly);
        ctx.lineTo(x + width, ly);
        ctx.stroke();
    }
    
    // Vertical grid lines (divisions along member)
    const numVLines = 10;
    for (let i = 0; i <= numVLines; i++) {
        const lx = x + (i * width) / numVLines;
        ctx.beginPath();
        ctx.moveTo(lx, y);
        ctx.lineTo(lx, y + height);
        ctx.stroke();
    }
    
    ctx.setLineDash([]);
}

function drawSupport(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    side: 'left' | 'right',
    color: string,
    supportType: SupportType = 'fixed'
) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    
    const size = 10;
    const dir = side === 'left' ? -1 : 1;

    if (supportType === 'free') {
        // Free end — no support symbol, just a small dot
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    if (supportType === 'roller') {
        // Roller: triangle pointing down + two small circles below
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - size * 0.7, y + size);
        ctx.lineTo(x + size * 0.7, y + size);
        ctx.closePath();
        ctx.stroke();

        // Two rollers (circles)
        const circR = 3;
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y + size + circR + 1, circR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + size * 0.3, y + size + circR + 1, circR, 0, Math.PI * 2);
        ctx.stroke();

        // Ground line below rollers
        ctx.beginPath();
        ctx.moveTo(x - size, y + size + 2 * circR + 2);
        ctx.lineTo(x + size, y + size + 2 * circR + 2);
        ctx.stroke();
        return;
    }

    if (supportType === 'pin') {
        // Pin: triangle pointing down + ground line + hatching
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - size * 0.7, y + size);
        ctx.lineTo(x + size * 0.7, y + size);
        ctx.closePath();
        ctx.stroke();

        // Ground line
        ctx.beginPath();
        ctx.moveTo(x - size, y + size + 1);
        ctx.lineTo(x + size, y + size + 1);
        ctx.stroke();

        // Hatching below ground line
        ctx.lineWidth = 1;
        for (let i = -size; i <= size; i += 4) {
            ctx.beginPath();
            ctx.moveTo(x + i, y + size + 1);
            ctx.lineTo(x + i - 4, y + size + 7);
            ctx.stroke();
        }
        return;
    }

    // Fixed support: vertical line + hatching (wall)
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();

    // Hatching
    ctx.lineWidth = 1;
    for (let i = -size; i <= size; i += 4) {
        ctx.beginPath();
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + dir * 6, y + i + 3 * dir);
        ctx.stroke();
    }
}

function drawValueLabels(
    ctx: CanvasRenderingContext2D,
    points: ForcePoint[],
    valueKey: keyof ForcePoint,
    x: number,
    centerY: number,
    width: number,
    valueScale: number,
    color: string,
    flipSign: boolean
) {
    if (!points || points.length === 0) return;

    ctx.fillStyle = color;
    ctx.font = '10px Arial';
    
    // Find extremes
    let maxPoint = points[0];
    let minPoint = points[0];
    let maxVal = -Infinity;
    let minVal = Infinity;
    
    for (const point of points) {
        let value = (point[valueKey] as number) || 0;
        if (flipSign) value = -value;
        if (value > maxVal) {
            maxVal = value;
            maxPoint = point;
        }
        if (value < minVal) {
            minVal = value;
            minPoint = point;
        }
    }
    
    const L = Math.max(points[points.length - 1]?.x || 0, 1e-9);
    
    // Draw start value
    const startVal = (points[0][valueKey] as number) || 0;
    const startPx = x;
    const startPy = centerY - (flipSign ? -startVal : startVal) * valueScale;
    
    ctx.textAlign = 'left';
    ctx.fillText(
        `${(flipSign ? -startVal : startVal).toFixed(2)}`,
        startPx + 5,
        startPy - 5
    );
    
    // Draw end value
    const endVal = (points[points.length - 1][valueKey] as number) || 0;
    const endPx = x + width;
    const endPy = centerY - (flipSign ? -endVal : endVal) * valueScale;
    
    ctx.textAlign = 'right';
    ctx.fillText(
        `${(flipSign ? -endVal : endVal).toFixed(2)}`,
        endPx - 5,
        endPy - 5
    );
    
    // Draw max value if different from endpoints
    if (Math.abs(maxVal) > Math.abs((flipSign ? -startVal : startVal)) * 1.1 &&
        Math.abs(maxVal) > Math.abs((flipSign ? -endVal : endVal)) * 1.1) {
        const maxPx = x + (maxPoint.x / L) * width;
        const maxPy = centerY - maxVal * valueScale;
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(`${maxVal.toFixed(2)}`, maxPx, maxPy - 8);
        
        // Draw marker
        ctx.beginPath();
        ctx.arc(maxPx, maxPy, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw min value if significantly different
    if (Math.abs(minVal) > Math.abs((flipSign ? -startVal : startVal)) * 1.1 &&
        Math.abs(minVal) > Math.abs((flipSign ? -endVal : endVal)) * 1.1 &&
        minPoint !== maxPoint) {
        const minPx = x + (minPoint.x / L) * width;
        const minPy = centerY - minVal * valueScale;
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(`${minVal.toFixed(2)}`, minPx, minPy + 15);
        
        // Draw marker
        ctx.beginPath();
        ctx.arc(minPx, minPy, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.font = '10px Arial';
}

export default ForceDiagramRenderer;
