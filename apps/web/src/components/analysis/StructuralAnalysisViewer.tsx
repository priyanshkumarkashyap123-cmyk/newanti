/**
 * ============================================================================
 * ENHANCED STRUCTURAL ANALYSIS UI V3.0
 * ============================================================================
 * 
 * Modern analysis visualization component with:
 * - Real-time structural diagram
 * - Bending moment diagrams
 * - Shear force diagrams
 * - Deflected shape
 * - Interactive member selection
 * - Load visualization
 * 
 * @version 3.0.0
 */


import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Download,
  ZoomIn,
  ZoomOut,
  Move,
  Eye,
  EyeOff,
  Layers,
  Grid,
  TrendingUp,
  TrendingDown,
  Activity,
  Box,
  Circle,
  Square,
  Triangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Maximize2,
  MinusCircle,
  PlusCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  BarChart2,
  LineChart,
  Table2,
  FileText,
  Share2,
  Printer,
  Lock,
  Unlock,
  Crosshair
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisNode {
  id: number;
  x: number;
  y: number;
  support?: 'fixed' | 'pinned' | 'roller' | 'free';
  displacement?: { dx: number; dy: number; rz: number };
  reactions?: { Rx: number; Ry: number; Mz?: number };
}

interface AnalysisMember {
  id: number;
  startNode: number;
  endNode: number;
  forces?: {
    startMoment: number;
    endMoment: number;
    startShear: number;
    endShear: number;
    axial: number;
  };
}

interface AnalysisLoad {
  type: 'point' | 'udl' | 'moment';
  nodeId?: number;
  memberId?: number;
  value: number;
  position?: number;
  direction?: 'down' | 'up' | 'left' | 'right';
}

interface AnalysisResult {
  maxMoment: { value: number; location: string };
  maxShear: { value: number; location: string };
  maxDeflection: { value: number; location: string };
  reactions: Array<{ nodeId: number; Rx: number; Ry: number; Mz?: number }>;
}

interface ViewSettings {
  showGrid: boolean;
  showNodeLabels: boolean;
  showMemberLabels: boolean;
  showLoads: boolean;
  showReactions: boolean;
  showDeflectedShape: boolean;
  showBMD: boolean;
  showSFD: boolean;
  showAFD: boolean;
  deflectionScale: number;
  diagramScale: number;
}

interface Props {
  nodes?: AnalysisNode[];
  members?: AnalysisMember[];
  loads?: AnalysisLoad[];
  result?: AnalysisResult;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const StructuralAnalysisViewer: React.FC<Props> = ({
  nodes: initialNodes = [],
  members: initialMembers = [],
  loads: initialLoads = [],
  result,
  onAnalyze,
  isAnalyzing = false
}) => {
  // State
  const [nodes, setNodes] = useState<AnalysisNode[]>(initialNodes);
  const [members, setMembers] = useState<AnalysisMember[]>(initialMembers);
  const [loads, setLoads] = useState<AnalysisLoad[]>(initialLoads);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'node' | 'member' | 'load';
    id: number;
  } | null>(null);
  
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showGrid: true,
    showNodeLabels: true,
    showMemberLabels: true,
    showLoads: true,
    showReactions: true,
    showDeflectedShape: false,
    showBMD: false,
    showSFD: false,
    showAFD: false,
    deflectionScale: 100,
    diagramScale: 50
  });
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'structure' | 'results' | 'table'>('structure');
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate view bounds
  const viewBounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 1000, minY: 0, maxY: 600 };
    }
    
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const padding = 100;
    
    return {
      minX: Math.min(...xs) - padding,
      maxX: Math.max(...xs) + padding,
      minY: Math.min(...ys) - padding,
      maxY: Math.max(...ys) + padding
    };
  }, [nodes]);

  // Coordinate transformation
  const transform = useCallback((x: number, y: number) => {
    const { minX, maxX, minY, maxY } = viewBounds;
    const width = maxX - minX;
    const height = maxY - minY;
    const viewWidth = 1000;
    const viewHeight = 600;
    
    const scale = Math.min(viewWidth / width, viewHeight / height) * zoom;
    
    return {
      x: ((x - minX) * scale + pan.x + viewWidth * (1 - zoom) / 2),
      y: (viewHeight - (y - minY) * scale + pan.y - viewHeight * (1 - zoom) / 2)
    };
  }, [viewBounds, zoom, pan]);

  // Handle zoom
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)));
  }, []);

  // Handle pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.ctrlKey) {
      setIsPanning(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Render support symbol
  const renderSupport = useCallback((node: AnalysisNode) => {
    const { x, y } = transform(node.x, node.y);
    const size = 20;
    
    switch (node.support) {
      case 'fixed':
        return (
          <g key={`support-${node.id}`}>
            <rect
              x={x - size / 2}
              y={y}
              width={size}
              height={size / 3}
              fill="currentColor"
              className="text-slate-500"
            />
            {[...Array(4)].map((_, i) => (
              <line
                key={i}
                x1={x - size / 2 + i * (size / 3)}
                y1={y + size / 3}
                x2={x - size / 2 + i * (size / 3) - 5}
                y2={y + size / 3 + 8}
                stroke="currentColor"
                strokeWidth="2"
                className="text-slate-500"
              />
            ))}
          </g>
        );
      
      case 'pinned':
        return (
          <g key={`support-${node.id}`}>
            <polygon
              points={`${x},${y} ${x - size / 2},${y + size} ${x + size / 2},${y + size}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-500"
            />
            <line
              x1={x - size / 2 - 5}
              y1={y + size + 3}
              x2={x + size / 2 + 5}
              y2={y + size + 3}
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-500"
            />
          </g>
        );
      
      case 'roller':
        return (
          <g key={`support-${node.id}`}>
            <polygon
              points={`${x},${y} ${x - size / 2},${y + size * 0.7} ${x + size / 2},${y + size * 0.7}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-500"
            />
            <circle
              cx={x - size / 4}
              cy={y + size * 0.85}
              r={4}
              fill="currentColor"
              className="text-slate-500"
            />
            <circle
              cx={x + size / 4}
              cy={y + size * 0.85}
              r={4}
              fill="currentColor"
              className="text-slate-500"
            />
            <line
              x1={x - size / 2 - 5}
              y1={y + size + 3}
              x2={x + size / 2 + 5}
              y2={y + size + 3}
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-500"
            />
          </g>
        );
      
      default:
        return null;
    }
  }, [transform]);

  // Render load symbol
  const renderLoad = useCallback((load: AnalysisLoad, index: number) => {
    if (load.type === 'point' && load.nodeId !== undefined) {
      const node = nodes.find(n => n.id === load.nodeId);
      if (!node) return null;
      
      const { x, y } = transform(node.x, node.y);
      const length = 50;
      const arrowSize = 10;
      
      return (
        <g key={`load-${index}`} className="text-red-500">
          <line
            x1={x}
            y1={y - length}
            x2={x}
            y2={y - 5}
            stroke="currentColor"
            strokeWidth="2"
          />
          <polygon
            points={`${x},${y - 5} ${x - arrowSize / 2},${y - 5 - arrowSize} ${x + arrowSize / 2},${y - 5 - arrowSize}`}
            fill="currentColor"
          />
          <text
            x={x + 10}
            y={y - length / 2}
            fill="currentColor"
            fontSize="12"
            fontWeight="600"
          >
            {load.value.toFixed(1)} kN
          </text>
        </g>
      );
    }
    
    if (load.type === 'udl' && load.memberId !== undefined) {
      const member = members.find(m => m.id === load.memberId);
      if (!member) return null;
      
      const startNode = nodes.find(n => n.id === member.startNode);
      const endNode = nodes.find(n => n.id === member.endNode);
      if (!startNode || !endNode) return null;
      
      const start = transform(startNode.x, startNode.y);
      const end = transform(endNode.x, endNode.y);
      const offset = 30;
      const arrowCount = 5;
      
      return (
        <g key={`load-${index}`} className="text-blue-500">
          {/* UDL arrows */}
          {[...Array(arrowCount)].map((_, i) => {
            const t = i / (arrowCount - 1);
            const px = start.x + (end.x - start.x) * t;
            const py = start.y + (end.y - start.y) * t;
            
            return (
              <g key={i}>
                <line
                  x1={px}
                  y1={py - offset - 20}
                  x2={px}
                  y2={py - 5}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <polygon
                  points={`${px},${py - 5} ${px - 4},${py - 12} ${px + 4},${py - 12}`}
                  fill="currentColor"
                />
              </g>
            );
          })}
          {/* UDL connecting line */}
          <line
            x1={start.x}
            y1={start.y - offset - 20}
            x2={end.x}
            y2={end.y - offset - 20}
            stroke="currentColor"
            strokeWidth="2"
          />
          <text
            x={(start.x + end.x) / 2}
            y={start.y - offset - 30}
            fill="currentColor"
            fontSize="12"
            fontWeight="600"
            textAnchor="middle"
          >
            {load.value.toFixed(1)} kN/m
          </text>
        </g>
      );
    }
    
    return null;
  }, [nodes, members, transform]);

  // Render BMD
  const renderBMD = useCallback((member: AnalysisMember) => {
    if (!member.forces) return null;
    
    const startNode = nodes.find(n => n.id === member.startNode);
    const endNode = nodes.find(n => n.id === member.endNode);
    if (!startNode || !endNode) return null;
    
    const start = transform(startNode.x, startNode.y);
    const end = transform(endNode.x, endNode.y);
    
    const { startMoment, endMoment } = member.forces;
    const scale = viewSettings.diagramScale / 100;
    
    // Scale moments for visualization
    const m1 = -startMoment * scale * 2;
    const m2 = -endMoment * scale * 2;
    
    // Calculate midpoint moment (parabolic for UDL)
    const midMoment = (m1 + m2) / 2 - Math.abs(m1 - m2) * 0.25;
    
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    const path = `
      M ${start.x} ${start.y}
      L ${start.x} ${start.y + m1}
      Q ${midX} ${midY + midMoment} ${end.x} ${end.y + m2}
      L ${end.x} ${end.y}
      Z
    `;
    
    return (
      <g key={`bmd-${member.id}`}>
        <path
          d={path}
          fill="rgba(239, 68, 68, 0.2)"
          stroke="#ef4444"
          strokeWidth="2"
        />
        {/* Moment values */}
        <text
          x={start.x + 5}
          y={start.y + m1 + (m1 > 0 ? -5 : 15)}
          fill="#ef4444"
          fontSize="10"
          fontWeight="600"
        >
          {Math.abs(startMoment).toFixed(1)}
        </text>
        <text
          x={end.x - 30}
          y={end.y + m2 + (m2 > 0 ? -5 : 15)}
          fill="#ef4444"
          fontSize="10"
          fontWeight="600"
        >
          {Math.abs(endMoment).toFixed(1)}
        </text>
      </g>
    );
  }, [nodes, transform, viewSettings.diagramScale]);

  // Render SFD
  const renderSFD = useCallback((member: AnalysisMember) => {
    if (!member.forces) return null;
    
    const startNode = nodes.find(n => n.id === member.startNode);
    const endNode = nodes.find(n => n.id === member.endNode);
    if (!startNode || !endNode) return null;
    
    const start = transform(startNode.x, startNode.y);
    const end = transform(endNode.x, endNode.y);
    
    const { startShear, endShear } = member.forces;
    const scale = viewSettings.diagramScale / 100;
    
    const s1 = -startShear * scale * 3;
    const s2 = -endShear * scale * 3;
    
    const path = `
      M ${start.x} ${start.y}
      L ${start.x} ${start.y + s1}
      L ${end.x} ${end.y + s2}
      L ${end.x} ${end.y}
      Z
    `;
    
    return (
      <g key={`sfd-${member.id}`}>
        <path
          d={path}
          fill="rgba(59, 130, 246, 0.2)"
          stroke="#3b82f6"
          strokeWidth="2"
        />
      </g>
    );
  }, [nodes, transform, viewSettings.diagramScale]);

  // Render deflected shape
  const renderDeflectedShape = useCallback(() => {
    if (!viewSettings.showDeflectedShape) return null;
    
    return members.map(member => {
      const startNode = nodes.find(n => n.id === member.startNode);
      const endNode = nodes.find(n => n.id === member.endNode);
      if (!startNode || !endNode) return null;
      
      const scale = viewSettings.deflectionScale;
      
      const startDisp = startNode.displacement || { dx: 0, dy: 0 };
      const endDisp = endNode.displacement || { dx: 0, dy: 0 };
      
      const start = transform(
        startNode.x + startDisp.dx * scale,
        startNode.y + startDisp.dy * scale
      );
      const end = transform(
        endNode.x + endDisp.dx * scale,
        endNode.y + endDisp.dy * scale
      );
      
      return (
        <line
          key={`deflected-${member.id}`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#10b981"
          strokeWidth="3"
          strokeDasharray="5,5"
          opacity={0.7}
        />
      );
    });
  }, [nodes, members, transform, viewSettings]);

  // Render reactions
  const renderReactions = useCallback(() => {
    if (!viewSettings.showReactions || !result) return null;
    
    return result.reactions.map(reaction => {
      const node = nodes.find(n => n.id === reaction.nodeId);
      if (!node) return null;
      
      const { x, y } = transform(node.x, node.y);
      const scale = 0.5;
      
      return (
        <g key={`reaction-${reaction.nodeId}`} className="text-green-600">
          {/* Vertical reaction */}
          {Math.abs(reaction.Ry) > 0.01 && (
            <g>
              <line
                x1={x}
                y1={y + 35}
                x2={x}
                y2={y + 35 + Math.abs(reaction.Ry) * scale}
                stroke="currentColor"
                strokeWidth="2"
              />
              <polygon
                points={`${x},${y + 30} ${x - 5},${y + 40} ${x + 5},${y + 40}`}
                fill="currentColor"
              />
              <text
                x={x + 10}
                y={y + 50}
                fill="currentColor"
                fontSize="11"
                fontWeight="600"
              >
                {reaction.Ry.toFixed(1)} kN
              </text>
            </g>
          )}
          {/* Horizontal reaction */}
          {Math.abs(reaction.Rx) > 0.01 && (
            <g>
              <line
                x1={x - 35}
                y1={y}
                x2={x - 35 - Math.abs(reaction.Rx) * scale}
                y2={y}
                stroke="currentColor"
                strokeWidth="2"
              />
              <polygon
                points={`${x - 30},${y} ${x - 40},${y - 5} ${x - 40},${y + 5}`}
                fill="currentColor"
              />
            </g>
          )}
          {/* Moment reaction */}
          {reaction.Mz && Math.abs(reaction.Mz) > 0.01 && (
            <g>
              <path
                d={`M ${x - 25} ${y - 15} A 20 20 0 1 1 ${x + 25} ${y - 15}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <polygon
                points={`${x + 25},${y - 15} ${x + 20},${y - 25} ${x + 30},${y - 20}`}
                fill="currentColor"
              />
              <text
                x={x}
                y={y - 35}
                fill="currentColor"
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
              >
                {reaction.Mz.toFixed(1)} kNm
              </text>
            </g>
          )}
        </g>
      );
    });
  }, [nodes, transform, viewSettings.showReactions, result]);

  // Render grid
  const renderGrid = useCallback(() => {
    if (!viewSettings.showGrid) return null;
    
    const gridSize = 50 * zoom;
    const lines = [];
    
    for (let x = 0; x <= 1000; x += gridSize) {
      lines.push(
        <line
          key={`grid-v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={600}
          stroke="#e2e8f0"
          strokeWidth="0.5"
        />
      );
    }
    
    for (let y = 0; y <= 600; y += gridSize) {
      lines.push(
        <line
          key={`grid-h-${y}`}
          x1={0}
          y1={y}
          x2={1000}
          y2={y}
          stroke="#e2e8f0"
          strokeWidth="0.5"
        />
      );
    }
    
    return <g>{lines}</g>;
  }, [viewSettings.showGrid, zoom]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl shadow-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Structural Analysis
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View controls */}
          <button
            onClick={() => handleZoom(0.25)}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-500"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-0.25)}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-500"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-500"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-slate-300 mx-1" />
          
          {/* View toggles */}
          <button
            onClick={() => setViewSettings(s => ({ ...s, showGrid: !s.showGrid }))}
            className={`p-2 rounded-lg ${viewSettings.showGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-500'}`}
            title="Toggle Grid"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewSettings(s => ({ ...s, showLoads: !s.showLoads }))}
            className={`p-2 rounded-lg ${viewSettings.showLoads ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-500'}`}
            title="Toggle Loads"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewSettings(s => ({ ...s, showBMD: !s.showBMD }))}
            className={`p-2 rounded-lg ${viewSettings.showBMD ? 'bg-red-100 text-red-600' : 'hover:bg-slate-200 text-slate-500'}`}
            title="Bending Moment Diagram"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewSettings(s => ({ ...s, showSFD: !s.showSFD }))}
            className={`p-2 rounded-lg ${viewSettings.showSFD ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-500'}`}
            title="Shear Force Diagram"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewSettings(s => ({ ...s, showDeflectedShape: !s.showDeflectedShape }))}
            className={`p-2 rounded-lg ${viewSettings.showDeflectedShape ? 'bg-green-100 text-green-600' : 'hover:bg-slate-200 text-slate-500'}`}
            title="Deflected Shape"
          >
            <Activity className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-slate-300 mx-1" />
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg ${showSettings ? 'bg-slate-200' : 'hover:bg-slate-200'} text-slate-500`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </motion.div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Analyze
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main canvas */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-slate-50 dark:bg-slate-900 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 1000 600"
            className="w-full h-full"
            style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
          >
            {/* Grid */}
            {renderGrid()}
            
            {/* Deflected shape (behind original) */}
            {viewSettings.showDeflectedShape && renderDeflectedShape()}
            
            {/* BMD */}
            {viewSettings.showBMD && members.map(renderBMD)}
            
            {/* SFD */}
            {viewSettings.showSFD && members.map(renderSFD)}
            
            {/* Members */}
            {members.map(member => {
              const startNode = nodes.find(n => n.id === member.startNode);
              const endNode = nodes.find(n => n.id === member.endNode);
              if (!startNode || !endNode) return null;
              
              const start = transform(startNode.x, startNode.y);
              const end = transform(endNode.x, endNode.y);
              
              return (
                <g key={`member-${member.id}`}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={selectedElement?.type === 'member' && selectedElement.id === member.id ? '#3b82f6' : '#1e293b'}
                    strokeWidth={selectedElement?.type === 'member' && selectedElement.id === member.id ? 4 : 3}
                    className="cursor-pointer hover:stroke-blue-500"
                    onClick={() => setSelectedElement({ type: 'member', id: member.id })}
                  />
                  {viewSettings.showMemberLabels && (
                    <text
                      x={(start.x + end.x) / 2}
                      y={(start.y + end.y) / 2 - 10}
                      fill="#64748b"
                      fontSize="12"
                      textAnchor="middle"
                    >
                      M{member.id}
                    </text>
                  )}
                </g>
              );
            })}
            
            {/* Supports */}
            {nodes.map(node => node.support && renderSupport(node))}
            
            {/* Nodes */}
            {nodes.map(node => {
              const { x, y } = transform(node.x, node.y);
              
              return (
                <g key={`node-${node.id}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={6}
                    fill={selectedElement?.type === 'node' && selectedElement.id === node.id ? '#3b82f6' : '#1e293b'}
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer hover:fill-blue-500"
                    onClick={() => setSelectedElement({ type: 'node', id: node.id })}
                  />
                  {viewSettings.showNodeLabels && (
                    <text
                      x={x}
                      y={y - 12}
                      fill="#64748b"
                      fontSize="11"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {node.id}
                    </text>
                  )}
                </g>
              );
            })}
            
            {/* Loads */}
            {viewSettings.showLoads && loads.map((load, index) => renderLoad(load, index))}
            
            {/* Reactions */}
            {renderReactions()}
          </svg>
          
          {/* Zoom indicator */}
          <div className="absolute bottom-4 left-4 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1 rounded-lg text-sm text-slate-500 dark:text-slate-400 shadow">
            Zoom: {(zoom * 100).toFixed(0)}%
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden"
            >
              <div className="p-4 space-y-6 w-[280px]">
                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Display Options</h3>
                  <div className="space-y-2">
                    {[
                      { key: 'showGrid', label: 'Show Grid' },
                      { key: 'showNodeLabels', label: 'Node Labels' },
                      { key: 'showMemberLabels', label: 'Member Labels' },
                      { key: 'showLoads', label: 'Show Loads' },
                      { key: 'showReactions', label: 'Show Reactions' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={viewSettings[key as keyof ViewSettings] as boolean}
                          onChange={e => setViewSettings(s => ({ ...s, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-500">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Diagrams</h3>
                  <div className="space-y-2">
                    {[
                      { key: 'showBMD', label: 'Bending Moment (BMD)', color: 'text-red-500' },
                      { key: 'showSFD', label: 'Shear Force (SFD)', color: 'text-blue-500' },
                      { key: 'showAFD', label: 'Axial Force (AFD)', color: 'text-purple-500' },
                      { key: 'showDeflectedShape', label: 'Deflected Shape', color: 'text-green-500' },
                    ].map(({ key, label, color }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={viewSettings[key as keyof ViewSettings] as boolean}
                          onChange={e => setViewSettings(s => ({ ...s, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm ${color}`}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Scale</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Deflection Scale: {viewSettings.deflectionScale}x</label>
                      <input
                        type="range"
                        min="10"
                        max="500"
                        value={viewSettings.deflectionScale}
                        onChange={e => setViewSettings(s => ({ ...s, deflectionScale: Number(e.target.value) }))}
                        className="w-full mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Diagram Scale: {viewSettings.diagramScale}%</label>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        value={viewSettings.diagramScale}
                        onChange={e => setViewSettings(s => ({ ...s, diagramScale: Number(e.target.value) }))}
                        className="w-full mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Selected element info */}
                {selectedElement && (
                  <div>
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
                      Selected {selectedElement.type === 'node' ? 'Node' : 'Member'}
                    </h3>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                      <p className="text-slate-500">ID: {selectedElement.id}</p>
                      {selectedElement.type === 'node' && (() => {
                        const node = nodes.find(n => n.id === selectedElement.id);
                        return node && (
                          <>
                            <p className="text-slate-500">X: {node.x.toFixed(2)} mm</p>
                            <p className="text-slate-500">Y: {node.y.toFixed(2)} mm</p>
                            {node.support && <p className="text-slate-500">Support: {node.support}</p>}
                          </>
                        );
                      })()}
                      {selectedElement.type === 'member' && (() => {
                        const member = members.find(m => m.id === selectedElement.id);
                        return member && (
                          <>
                            <p className="text-slate-500">Start: Node {member.startNode}</p>
                            <p className="text-slate-500">End: Node {member.endNode}</p>
                            {member.forces && (
                              <>
                                <div className="mt-2 pt-2 border-t">
                                  <p className="text-red-600">M₁: {member.forces.startMoment.toFixed(2)} kNm</p>
                                  <p className="text-red-600">M₂: {member.forces.endMoment.toFixed(2)} kNm</p>
                                  <p className="text-blue-600">V₁: {member.forces.startShear.toFixed(2)} kN</p>
                                  <p className="text-blue-600">V₂: {member.forces.endShear.toFixed(2)} kN</p>
                                </div>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results summary bar */}
      {result && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3"
        >
          <div className="flex items-center justify-around text-sm">
            <div className="flex items-center gap-2">
              <span className="text-red-500 font-medium">Max Moment:</span>
              <span className="text-slate-600 dark:text-slate-300">{result.maxMoment.value.toFixed(2)} kNm @ {result.maxMoment.location}</span>
            </div>
            <div className="w-px h-4 bg-slate-600" />
            <div className="flex items-center gap-2">
              <span className="text-blue-500 font-medium">Max Shear:</span>
              <span className="text-slate-600 dark:text-slate-300">{result.maxShear.value.toFixed(2)} kN @ {result.maxShear.location}</span>
            </div>
            <div className="w-px h-4 bg-slate-600" />
            <div className="flex items-center gap-2">
              <span className="text-green-500 font-medium">Max Deflection:</span>
              <span className="text-slate-600 dark:text-slate-300">{result.maxDeflection.value.toFixed(3)} mm @ {result.maxDeflection.location}</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default StructuralAnalysisViewer;
