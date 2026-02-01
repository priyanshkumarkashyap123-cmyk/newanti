import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { DiagramGenerator } from '@/modules/visualization/StructuralVisualizationEngine';
import { BarChart3, Move, Maximize2, Grid3X3, Play, Pause, RotateCcw, Download } from 'lucide-react';
import { useModelStore } from '@/store/model';

type DiagramType = 'bmd' | 'sfd' | 'deflection' | 'axial';

interface LocalDiagramPoint {
  x: number;
  y: number;
  value: number;
}

export default function VisualizationHubPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useModelStore();
  const [diagramType, setDiagramType] = useState<DiagramType>('bmd');
  const [span, setSpan] = useState(6);
  const [maxValue, setMaxValue] = useState(45);
  const [isAnimating, setIsAnimating] = useState(false);
  const [scale, setScale] = useState(1);
  const animationRef = useRef<number | null>(null);

  // Generate diagram data based on type
  const diagramData = useMemo(() => {
    const numPoints = 51;
    const points: LocalDiagramPoint[] = [];
    
    for (let i = 0; i <= numPoints - 1; i++) {
      const x = (i / (numPoints - 1)) * span;
      let value = 0;
      
      switch (diagramType) {
        case 'bmd':
          // Parabolic for uniformly loaded simply supported beam
          value = maxValue * 4 * (x / span) * (1 - x / span);
          break;
        case 'sfd':
          // Linear for uniformly loaded beam
          value = maxValue * (1 - 2 * x / span);
          break;
        case 'deflection':
          // Cubic deflection curve
          const xn = x / span;
          value = -maxValue * 0.1 * xn * (1 - xn) * (1 + xn - xn * xn);
          break;
        case 'axial':
          // Constant or stepped
          value = i < numPoints / 2 ? maxValue * 0.8 : maxValue * 0.5;
          break;
      }
      points.push({ x, y: 0, value });
    }
    return points;
  }, [diagramType, span, maxValue]);

  // Draw diagram on canvas
  const drawDiagram = useCallback((animationProgress = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const y = padding + (i / 10) * (height - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Axis
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.stroke();
    
    // Draw beam
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.stroke();
    
    // Supports
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(padding - 10, height / 2 + 15);
    ctx.lineTo(padding + 10, height / 2 + 15);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(width - padding, height / 2);
    ctx.lineTo(width - padding - 10, height / 2 + 15);
    ctx.lineTo(width - padding + 10, height / 2 + 15);
    ctx.closePath();
    ctx.fill();
    
    // Draw diagram
    const maxAbsValue = Math.max(...diagramData.map(p => Math.abs(p.value)));
    const scaleFactor = ((height / 2 - padding) * 0.8) / maxAbsValue * scale;
    
    const colors: Record<DiagramType, string> = {
      bmd: '#22c55e',
      sfd: '#f97316',
      deflection: '#8b5cf6',
      axial: '#ef4444'
    };
    
    ctx.fillStyle = colors[diagramType] + '40';
    ctx.strokeStyle = colors[diagramType];
    ctx.lineWidth = 2;
    
    const visiblePoints = Math.floor(diagramData.length * animationProgress);
    
    // Fill area
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    for (let i = 0; i < visiblePoints; i++) {
      const point = diagramData[i];
      const x = padding + (point.x / span) * (width - 2 * padding);
      const y = height / 2 - point.value * scaleFactor;
      ctx.lineTo(x, y);
    }
    if (visiblePoints > 0) {
      const lastPoint = diagramData[visiblePoints - 1];
      const lastX = padding + (lastPoint.x / span) * (width - 2 * padding);
      ctx.lineTo(lastX, height / 2);
    }
    ctx.closePath();
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    for (let i = 0; i < visiblePoints; i++) {
      const point = diagramData[i];
      const x = padding + (point.x / span) * (width - 2 * padding);
      const y = height / 2 - point.value * scaleFactor;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px monospace';
    ctx.fillText('0', padding - 5, height / 2 + 30);
    ctx.fillText(`${span}m`, width - padding - 10, height / 2 + 30);
    ctx.fillText(`Max: ${maxValue.toFixed(1)} ${diagramType === 'bmd' ? 'kN·m' : diagramType === 'sfd' ? 'kN' : 'mm'}`, padding, 25);
    
    // Title
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(
      diagramType === 'bmd' ? 'Bending Moment Diagram' :
      diagramType === 'sfd' ? 'Shear Force Diagram' :
      diagramType === 'deflection' ? 'Deflected Shape' : 'Axial Force Diagram',
      width / 2 - 80, 25
    );
  }, [diagramData, diagramType, span, maxValue, scale]);

  // Animation loop
  useEffect(() => {
    if (isAnimating) {
      let progress = 0;
      const animate = () => {
        progress += 0.02;
        if (progress >= 1) {
          progress = 1;
          setIsAnimating(false);
        }
        drawDiagram(progress);
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      drawDiagram(1);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isAnimating, drawDiagram]);

  const startAnimation = () => {
    setIsAnimating(true);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramType}_diagram.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Visualization</p>
            <h1 className="text-2xl font-bold">Structural Visualization Hub</h1>
            <p className="text-slate-400">Interactive diagrams for structural analysis results.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={startAnimation} disabled={isAnimating} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
              <Play className="w-4 h-4" /> Animate
            </button>
            <button onClick={downloadImage} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <Download className="w-4 h-4" /> Save PNG
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {/* Diagram Type Selector */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400" /> Diagram Type</h2>
            <div className="space-y-2">
              {(['bmd', 'sfd', 'deflection', 'axial'] as DiagramType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setDiagramType(type)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    diagramType === type ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {type === 'bmd' ? 'Bending Moment' : type === 'sfd' ? 'Shear Force' : type === 'deflection' ? 'Deflected Shape' : 'Axial Force'}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Move className="w-5 h-5 text-purple-400" /> Controls</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Span (m)</label>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={span}
                  onChange={e => setSpan(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-sm">{span} m</span>
              </div>
              <div>
                <label className="text-xs text-slate-400">Max Value</label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={maxValue}
                  onChange={e => setMaxValue(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-sm">{maxValue.toFixed(0)}</span>
              </div>
              <div>
                <label className="text-xs text-slate-400">Scale</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={scale}
                  onChange={e => setScale(parseFloat(e.target.value))}
                  className="w-full"
                />
                <span className="text-sm">{scale.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <canvas
              ref={canvasRef}
              width={600}
              height={300}
              className="w-full rounded-lg"
            />
          </div>
        </section>

        {/* Data Table */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-green-400" /> 
            Diagram Data (first 10 points)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left p-2">X (m)</th>
                  <th className="text-right p-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {diagramData.slice(0, 10).map((point, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="p-2">{point.x.toFixed(2)}</td>
                    <td className="text-right p-2">{point.value.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
