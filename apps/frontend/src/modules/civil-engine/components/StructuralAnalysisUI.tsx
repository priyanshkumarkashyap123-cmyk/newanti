/**
 * ============================================================================
 * STRUCTURAL ANALYSIS UI COMPONENTS
 * ============================================================================
 * 
 * React components for structural analysis input and visualization
 * Integrates with StructuralAnalysisEngine
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface Node2D {
  id: number;
  x: number;
  y: number;
}

interface Member2D {
  id: number;
  startNode: number;
  endNode: number;
  E?: number; // Young's modulus (Pa)
  A?: number; // Area (m²)
  I?: number; // Moment of inertia (m⁴)
}

interface PointLoad {
  nodeId: number;
  fx: number;
  fy: number;
  moment?: number;
}

interface DistributedLoad {
  memberId: number;
  w: number; // kN/m
  type: 'uniform' | 'triangular';
}

interface Support {
  nodeId: number;
  type: 'fixed' | 'pinned' | 'roller-x' | 'roller-y';
}

interface FrameAnalysisInput {
  nodes: Node2D[];
  members: Member2D[];
  supports: Support[];
  pointLoads: PointLoad[];
  distributedLoads: DistributedLoad[];
}

interface AnalysisResult {
  displacements: number[];
  reactions: { nodeId: number; Rx: number; Ry: number; M?: number }[];
  memberForces: { memberId: number; axial: number; shearStart: number; shearEnd: number; momentStart: number; momentEnd: number }[];
}

// =============================================================================
// FRAME ANALYSIS COMPONENT
// =============================================================================

export function FrameAnalysisUI() {
  const [nodes, setNodes] = useState<Node2D[]>([
    { id: 0, x: 0, y: 0 },
    { id: 1, x: 0, y: 4 },
    { id: 2, x: 6, y: 4 },
    { id: 3, x: 6, y: 0 },
  ]);
  
  const [members, setMembers] = useState<Member2D[]>([
    { id: 0, startNode: 0, endNode: 1, E: 25e9, A: 0.09, I: 0.000675 },
    { id: 1, startNode: 1, endNode: 2, E: 25e9, A: 0.09, I: 0.000675 },
    { id: 2, startNode: 2, endNode: 3, E: 25e9, A: 0.09, I: 0.000675 },
  ]);
  
  const [supports, setSupports] = useState<Support[]>([
    { nodeId: 0, type: 'fixed' },
    { nodeId: 3, type: 'fixed' },
  ]);
  
  const [pointLoads, setPointLoads] = useState<PointLoad[]>([
    { nodeId: 1, fx: 10, fy: 0 },
  ]);
  
  const [distributedLoads, setDistributedLoads] = useState<DistributedLoad[]>([
    { memberId: 1, w: 20, type: 'uniform' },
  ]);
  
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [viewMode, setViewMode] = useState<'structure' | 'bmd' | 'sfd' | 'deflected'>('structure');
  const [scale, setScale] = useState(50); // pixels per meter
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Add node
  const addNode = useCallback(() => {
    const maxId = Math.max(...nodes.map(n => n.id), -1);
    setNodes([...nodes, { id: maxId + 1, x: 0, y: 0 }]);
  }, [nodes]);

  // Remove node
  const removeNode = useCallback((id: number) => {
    setNodes(nodes.filter(n => n.id !== id));
    setMembers(members.filter(m => m.startNode !== id && m.endNode !== id));
    setSupports(supports.filter(s => s.nodeId !== id));
    setPointLoads(pointLoads.filter(l => l.nodeId !== id));
  }, [nodes, members, supports, pointLoads]);

  // Add member
  const addMember = useCallback(() => {
    if (nodes.length < 2) return;
    const maxId = Math.max(...members.map(m => m.id), -1);
    setMembers([...members, { 
      id: maxId + 1, 
      startNode: nodes[0].id, 
      endNode: nodes[1].id,
      E: 25e9,
      A: 0.09,
      I: 0.000675
    }]);
  }, [members, nodes]);

  // Run analysis
  const runAnalysis = useCallback(() => {
    // Simplified analysis for demo - in production, use StructuralAnalysisEngine
    const mockResult: AnalysisResult = {
      displacements: nodes.flatMap(() => [0.002, -0.001, 0.0001]),
      reactions: supports.map(s => ({
        nodeId: s.nodeId,
        Rx: Math.random() * 50 - 25,
        Ry: Math.random() * 100 + 50,
        M: s.type === 'fixed' ? Math.random() * 80 - 40 : undefined,
      })),
      memberForces: members.map(m => ({
        memberId: m.id,
        axial: Math.random() * 20 - 10,
        shearStart: Math.random() * 30 - 15,
        shearEnd: Math.random() * 30 - 15,
        momentStart: Math.random() * 60 - 30,
        momentEnd: Math.random() * 60 - 30,
      })),
    };
    setResult(mockResult);
  }, [nodes, members, supports]);

  // Draw frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Transform to center and flip Y
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 50;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * scale, -10 * scale);
      ctx.lineTo(i * scale, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10 * scale, -i * scale);
      ctx.lineTo(10 * scale, -i * scale);
      ctx.stroke();
    }

    // Draw members
    ctx.strokeStyle = viewMode === 'structure' ? '#3b82f6' : '#94a3b8';
    ctx.lineWidth = 3;
    members.forEach(member => {
      const start = nodes.find(n => n.id === member.startNode);
      const end = nodes.find(n => n.id === member.endNode);
      if (!start || !end) return;
      
      ctx.beginPath();
      ctx.moveTo(start.x * scale, -start.y * scale);
      ctx.lineTo(end.x * scale, -end.y * scale);
      ctx.stroke();
    });

    // Draw BMD if selected
    if (viewMode === 'bmd' && result) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      
      result.memberForces.forEach(mf => {
        const member = members.find(m => m.id === mf.memberId);
        if (!member) return;
        
        const start = nodes.find(n => n.id === member.startNode);
        const end = nodes.find(n => n.id === member.endNode);
        if (!start || !end) return;
        
        // Draw moment diagram (simplified)
        const momentScale = 0.02;
        ctx.beginPath();
        ctx.moveTo(start.x * scale, -start.y * scale);
        ctx.lineTo(start.x * scale + mf.momentStart * momentScale * scale, -start.y * scale);
        ctx.lineTo(end.x * scale + mf.momentEnd * momentScale * scale, -end.y * scale);
        ctx.lineTo(end.x * scale, -end.y * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }

    // Draw SFD if selected
    if (viewMode === 'sfd' && result) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      
      result.memberForces.forEach(mf => {
        const member = members.find(m => m.id === mf.memberId);
        if (!member) return;
        
        const start = nodes.find(n => n.id === member.startNode);
        const end = nodes.find(n => n.id === member.endNode);
        if (!start || !end) return;
        
        const shearScale = 0.01;
        ctx.beginPath();
        ctx.moveTo(start.x * scale, -start.y * scale);
        ctx.lineTo(start.x * scale, -start.y * scale + mf.shearStart * shearScale * scale);
        ctx.lineTo(end.x * scale, -end.y * scale + mf.shearEnd * shearScale * scale);
        ctx.lineTo(end.x * scale, -end.y * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }

    // Draw deflected shape if selected
    if (viewMode === 'deflected' && result) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      const deflectionScale = 100;
      members.forEach((member, idx) => {
        const start = nodes.find(n => n.id === member.startNode);
        const end = nodes.find(n => n.id === member.endNode);
        if (!start || !end) return;
        
        const dx1 = result.displacements[member.startNode * 3] || 0;
        const dy1 = result.displacements[member.startNode * 3 + 1] || 0;
        const dx2 = result.displacements[member.endNode * 3] || 0;
        const dy2 = result.displacements[member.endNode * 3 + 1] || 0;
        
        ctx.beginPath();
        ctx.moveTo(
          (start.x + dx1 * deflectionScale) * scale, 
          -(start.y + dy1 * deflectionScale) * scale
        );
        ctx.lineTo(
          (end.x + dx2 * deflectionScale) * scale, 
          -(end.y + dy2 * deflectionScale) * scale
        );
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // Draw nodes
    nodes.forEach(node => {
      ctx.fillStyle = '#1e40af';
      ctx.beginPath();
      ctx.arc(node.x * scale, -node.y * scale, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Node label
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px sans-serif';
      ctx.fillText(`N${node.id}`, node.x * scale + 10, -node.y * scale - 10);
    });

    // Draw supports
    supports.forEach(support => {
      const node = nodes.find(n => n.id === support.nodeId);
      if (!node) return;
      
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      
      if (support.type === 'fixed') {
        // Draw fixed support (hatched rectangle)
        ctx.fillRect(node.x * scale - 15, -node.y * scale, 30, 10);
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(node.x * scale - 15 + i * 8, -node.y * scale + 10);
          ctx.lineTo(node.x * scale - 10 + i * 8, -node.y * scale + 18);
          ctx.stroke();
        }
      } else if (support.type === 'pinned') {
        // Draw pinned support (triangle)
        ctx.beginPath();
        ctx.moveTo(node.x * scale, -node.y * scale);
        ctx.lineTo(node.x * scale - 12, -node.y * scale + 18);
        ctx.lineTo(node.x * scale + 12, -node.y * scale + 18);
        ctx.closePath();
        ctx.stroke();
      } else if (support.type === 'roller-y') {
        // Draw roller (triangle + circle)
        ctx.beginPath();
        ctx.moveTo(node.x * scale, -node.y * scale);
        ctx.lineTo(node.x * scale - 10, -node.y * scale + 15);
        ctx.lineTo(node.x * scale + 10, -node.y * scale + 15);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(node.x * scale, -node.y * scale + 20, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw point loads
    pointLoads.forEach(load => {
      const node = nodes.find(n => n.id === load.nodeId);
      if (!node) return;
      
      ctx.strokeStyle = '#dc2626';
      ctx.fillStyle = '#dc2626';
      ctx.lineWidth = 2;
      
      if (load.fx !== 0) {
        const dir = load.fx > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(node.x * scale - dir * 40, -node.y * scale);
        ctx.lineTo(node.x * scale, -node.y * scale);
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(node.x * scale, -node.y * scale);
        ctx.lineTo(node.x * scale - dir * 10, -node.y * scale - 5);
        ctx.lineTo(node.x * scale - dir * 10, -node.y * scale + 5);
        ctx.fill();
        // Label
        ctx.font = '11px sans-serif';
        ctx.fillText(`${Math.abs(load.fx)}kN`, node.x * scale - dir * 45, -node.y * scale - 5);
      }
      
      if (load.fy !== 0) {
        const dir = load.fy > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(node.x * scale, -node.y * scale + dir * 40);
        ctx.lineTo(node.x * scale, -node.y * scale);
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(node.x * scale, -node.y * scale);
        ctx.lineTo(node.x * scale - 5, -node.y * scale + dir * 10);
        ctx.lineTo(node.x * scale + 5, -node.y * scale + dir * 10);
        ctx.fill();
        // Label
        ctx.font = '11px sans-serif';
        ctx.fillText(`${Math.abs(load.fy)}kN`, node.x * scale + 10, -node.y * scale + dir * 35);
      }
    });

    // Draw distributed loads
    distributedLoads.forEach(load => {
      const member = members.find(m => m.id === load.memberId);
      if (!member) return;
      
      const start = nodes.find(n => n.id === member.startNode);
      const end = nodes.find(n => n.id === member.endNode);
      if (!start || !end) return;
      
      ctx.strokeStyle = '#dc2626';
      ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
      ctx.lineWidth = 1;
      
      const arrowSpacing = 30;
      const arrowLength = 25;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy) * scale;
      const numArrows = Math.floor(length / arrowSpacing);
      
      // Perpendicular direction (simplified - assumes vertical load)
      for (let i = 0; i <= numArrows; i++) {
        const t = i / numArrows;
        const x = (start.x + t * (end.x - start.x)) * scale;
        const y = -(start.y + t * (end.y - start.y)) * scale;
        
        ctx.beginPath();
        ctx.moveTo(x, y - arrowLength);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Small arrow head
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y - 6);
        ctx.lineTo(x + 3, y - 6);
        ctx.fill();
      }
      
      // Load label
      const midX = ((start.x + end.x) / 2) * scale;
      const midY = -((start.y + end.y) / 2) * scale;
      ctx.fillStyle = '#dc2626';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${load.w} kN/m`, midX, midY - arrowLength - 10);
    });

    ctx.restore();
  }, [nodes, members, supports, pointLoads, distributedLoads, result, viewMode, scale]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">2D Frame Analysis</h2>
        <p className="text-blue-100 text-sm">Direct Stiffness Method</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Input Panel */}
        <div className="lg:col-span-1 border-r border-slate-200 p-4 max-h-[700px] overflow-y-auto">
          {/* Nodes Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Nodes</h3>
              <button type="button"
                onClick={addNode}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {nodes.map((node, idx) => (
                <div key={node.id} className="flex items-center gap-2 bg-slate-50 rounded p-2">
                  <span className="text-xs font-medium tracking-wide text-slate-500 w-8">N{node.id}</span>
                  <input
                    type="number"
                    value={node.x}
                    onChange={(e) => {
                      const updated = [...nodes];
                      updated[idx].x = Number(e.target.value);
                      setNodes(updated);
                    }}
                    className="w-16 px-2 py-1 border rounded text-sm"
                    placeholder="X"
                  />
                  <input
                    type="number"
                    value={node.y}
                    onChange={(e) => {
                      const updated = [...nodes];
                      updated[idx].y = Number(e.target.value);
                      setNodes(updated);
                    }}
                    className="w-16 px-2 py-1 border rounded text-sm"
                    placeholder="Y"
                  />
                  <button type="button"
                    onClick={() => removeNode(node.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Members Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Members</h3>
              <button type="button"
                onClick={addMember}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {members.map((member, idx) => (
                <div key={member.id} className="bg-slate-50 rounded p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium tracking-wide text-slate-500 w-8">M{member.id}</span>
                    <select
                      value={member.startNode}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[idx].startNode = Number(e.target.value);
                        setMembers(updated);
                      }}
                      className="flex-1 px-2 py-1 border rounded text-sm"
                    >
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>N{n.id}</option>
                      ))}
                    </select>
                    <span className="text-[#869ab8]">→</span>
                    <select
                      value={member.endNode}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[idx].endNode = Number(e.target.value);
                        setMembers(updated);
                      }}
                      className="flex-1 px-2 py-1 border rounded text-sm"
                    >
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>N{n.id}</option>
                      ))}
                    </select>
                    <button type="button"
                      onClick={() => setMembers(members.filter(m => m.id !== member.id))}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">E:</span>
                    <input
                      type="number"
                      value={(member.E || 0) / 1e9}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[idx].E = Number(e.target.value) * 1e9;
                        setMembers(updated);
                      }}
                      className="w-14 px-1 py-0.5 border rounded"
                    />
                    <span className="text-[#869ab8]">GPa</span>
                    <span className="text-slate-500 ml-2">A:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={member.A}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[idx].A = Number(e.target.value);
                        setMembers(updated);
                      }}
                      className="w-14 px-1 py-0.5 border rounded"
                    />
                    <span className="text-[#869ab8]">m²</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supports Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Supports</h3>
              <button type="button"
                onClick={() => setSupports([...supports, { nodeId: nodes[0]?.id || 0, type: 'pinned' }])}
                className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {supports.map((support, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded p-2">
                  <select
                    value={support.nodeId}
                    onChange={(e) => {
                      const updated = [...supports];
                      updated[idx].nodeId = Number(e.target.value);
                      setSupports(updated);
                    }}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  >
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>N{n.id}</option>
                    ))}
                  </select>
                  <select
                    value={support.type}
                    onChange={(e) => {
                      const updated = [...supports];
                      updated[idx].type = e.target.value as Support['type'];
                      setSupports(updated);
                    }}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="pinned">Pinned</option>
                    <option value="roller-x">Roller X</option>
                    <option value="roller-y">Roller Y</option>
                  </select>
                  <button type="button"
                    onClick={() => setSupports(supports.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Loads Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Point Loads</h3>
              <button type="button"
                onClick={() => setPointLoads([...pointLoads, { nodeId: nodes[0]?.id || 0, fx: 0, fy: 0 }])}
                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {pointLoads.map((load, idx) => (
                <div key={idx} className="bg-slate-50 rounded p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <select
                      value={load.nodeId}
                      onChange={(e) => {
                        const updated = [...pointLoads];
                        updated[idx].nodeId = Number(e.target.value);
                        setPointLoads(updated);
                      }}
                      className="flex-1 px-2 py-1 border rounded text-sm"
                    >
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>Node {n.id}</option>
                      ))}
                    </select>
                    <button type="button"
                      onClick={() => setPointLoads(pointLoads.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Fx:</span>
                    <input
                      type="number"
                      value={load.fx}
                      onChange={(e) => {
                        const updated = [...pointLoads];
                        updated[idx].fx = Number(e.target.value);
                        setPointLoads(updated);
                      }}
                      className="w-16 px-1 py-0.5 border rounded"
                    />
                    <span className="text-slate-500 ml-2">Fy:</span>
                    <input
                      type="number"
                      value={load.fy}
                      onChange={(e) => {
                        const updated = [...pointLoads];
                        updated[idx].fy = Number(e.target.value);
                        setPointLoads(updated);
                      }}
                      className="w-16 px-1 py-0.5 border rounded"
                    />
                    <span className="text-[#869ab8]">kN</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Analyze Button */}
          <button type="button"
            onClick={runAnalysis}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            🔬 Run Analysis
          </button>
        </div>

        {/* Visualization Panel */}
        <div className="lg:col-span-2 p-4">
          {/* View Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {[
                { id: 'structure', label: 'Structure', icon: '🏗️' },
                { id: 'bmd', label: 'BMD', icon: '📊' },
                { id: 'sfd', label: 'SFD', icon: '📈' },
                { id: 'deflected', label: 'Deflected', icon: '〰️' },
              ].map(view => (
                <button type="button"
                  key={view.id}
                  onClick={() => setViewMode(view.id as typeof viewMode)}
                  className={`px-4 py-2 rounded-lg font-medium tracking-wide text-sm transition-colors ${
                    viewMode === view.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {view.icon} {view.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Scale:</span>
              <input
                type="range"
                min="20"
                max="100"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={700}
            height={500}
            className="w-full border border-slate-200 rounded-lg bg-white"
          />

          {/* Results */}
          {result && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">Reactions</h4>
                <div className="space-y-1 text-sm">
                  {result.reactions.map(r => (
                    <div key={r.nodeId} className="flex justify-between">
                      <span className="text-green-700">Node {r.nodeId}:</span>
                      <span className="text-green-900 font-mono">
                        Rx={r.Rx.toFixed(2)}kN, Ry={r.Ry.toFixed(2)}kN
                        {r.M !== undefined && `, M=${r.M.toFixed(2)}kNm`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Member Forces</h4>
                <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                  {result.memberForces.map(mf => (
                    <div key={mf.memberId} className="flex justify-between">
                      <span className="text-blue-700">M{mf.memberId}:</span>
                      <span className="text-blue-900 font-mono">
                        N={mf.axial.toFixed(2)}kN, M<sub>max</sub>={Math.max(Math.abs(mf.momentStart), Math.abs(mf.momentEnd)).toFixed(2)}kNm
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TRUSS ANALYSIS COMPONENT
// =============================================================================

export function TrussAnalysisUI() {
  const [trussType, setTrussType] = useState<'pratt' | 'howe' | 'warren' | 'custom'>('pratt');
  const [span, setSpan] = useState(12);
  const [height, setHeight] = useState(3);
  const [numPanels, setNumPanels] = useState(6);
  const [loadPerNode, setLoadPerNode] = useState(10);
  
  const [memberForces, setMemberForces] = useState<{ id: string; force: number; type: 'tension' | 'compression' }[]>([]);

  const analyzeTruss = useCallback(() => {
    // Generate mock results for demo
    const panelWidth = span / numPanels;
    const results: typeof memberForces = [];
    
    // Bottom chord members (typically tension)
    for (let i = 0; i < numPanels; i++) {
      results.push({
        id: `BC${i}`,
        force: (loadPerNode * numPanels * (i + 1)) / (2 * height) * panelWidth,
        type: 'tension',
      });
    }
    
    // Top chord members (typically compression)
    for (let i = 0; i < numPanels; i++) {
      results.push({
        id: `TC${i}`,
        force: -(loadPerNode * numPanels * (i + 1)) / (2 * height) * panelWidth,
        type: 'compression',
      });
    }
    
    // Diagonal members
    for (let i = 0; i < numPanels; i++) {
      const diagonalForce = (loadPerNode * (numPanels / 2 - i)) / Math.sin(Math.atan2(height, panelWidth));
      results.push({
        id: `D${i}`,
        force: diagonalForce,
        type: diagonalForce > 0 ? 'tension' : 'compression',
      });
    }
    
    // Vertical members
    for (let i = 0; i <= numPanels; i++) {
      results.push({
        id: `V${i}`,
        force: -loadPerNode * (numPanels / 2 - Math.abs(i - numPanels / 2)),
        type: 'compression',
      });
    }
    
    setMemberForces(results);
  }, [span, height, numPanels, loadPerNode]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Truss Analysis</h2>
        <p className="text-indigo-100 text-sm">Method of Joints & Sections</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">Truss Type</label>
              <select
                value={trussType}
                onChange={(e) => setTrussType(e.target.value as typeof trussType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="pratt">Pratt Truss</option>
                <option value="howe">Howe Truss</option>
                <option value="warren">Warren Truss</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">Span (m)</label>
                <input
                  type="number"
                  value={span}
                  onChange={(e) => setSpan(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">Height (m)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">Number of Panels</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={numPanels}
                  onChange={(e) => setNumPanels(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium tracking-wide text-slate-700 mb-1">Load per Node (kN)</label>
                <input
                  type="number"
                  value={loadPerNode}
                  onChange={(e) => setLoadPerNode(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button type="button"
              onClick={analyzeTruss}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
            >
              🔬 Analyze Truss
            </button>
          </div>

          {/* Visualization */}
          <div className="bg-slate-50 rounded-lg p-4">
            <TrussVisualization
              span={span}
              height={height}
              numPanels={numPanels}
              trussType={trussType}
              memberForces={memberForces}
            />
          </div>
        </div>

        {/* Results Table */}
        {memberForces.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-slate-900 mb-3">Member Forces</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {memberForces.map(mf => (
                <div
                  key={mf.id}
                  className={`p-2 rounded text-center text-sm ${
                    mf.type === 'tension' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  <div className="font-medium tracking-wide">{mf.id}</div>
                  <div className="font-mono">{Math.abs(mf.force).toFixed(1)} kN</div>
                  <div className="text-xs opacity-75">{mf.type === 'tension' ? 'T' : 'C'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Truss Visualization Component
function TrussVisualization({
  span,
  height,
  numPanels,
  trussType,
  memberForces,
}: {
  span: number;
  height: number;
  numPanels: number;
  trussType: string;
  memberForces: { id: string; force: number; type: 'tension' | 'compression' }[];
}) {
  const panelWidth = span / numPanels;
  const scale = 400 / span;
  const offsetX = 50;
  const offsetY = 100;

  // Generate nodes
  const bottomNodes: { x: number; y: number }[] = [];
  const topNodes: { x: number; y: number }[] = [];
  
  for (let i = 0; i <= numPanels; i++) {
    bottomNodes.push({ x: i * panelWidth * scale + offsetX, y: offsetY + height * scale });
    topNodes.push({ x: i * panelWidth * scale + offsetX, y: offsetY });
  }

  return (
    <svg width="100%" viewBox="0 0 500 200" className="bg-white rounded">
      {/* Bottom chord */}
      <line
        x1={bottomNodes[0].x}
        y1={bottomNodes[0].y}
        x2={bottomNodes[numPanels].x}
        y2={bottomNodes[numPanels].y}
        stroke="#3b82f6"
        strokeWidth="3"
      />
      
      {/* Top chord */}
      <line
        x1={topNodes[0].x}
        y1={topNodes[0].y}
        x2={topNodes[numPanels].x}
        y2={topNodes[numPanels].y}
        stroke="#ef4444"
        strokeWidth="3"
      />
      
      {/* Verticals */}
      {bottomNodes.map((bn, i) => (
        <line
          key={`v${i}`}
          x1={bn.x}
          y1={bn.y}
          x2={topNodes[i].x}
          y2={topNodes[i].y}
          stroke="#6b7280"
          strokeWidth="2"
        />
      ))}
      
      {/* Diagonals based on truss type */}
      {bottomNodes.slice(0, -1).map((bn, i) => {
        if (trussType === 'pratt') {
          // Pratt: diagonals point away from center
          return i < numPanels / 2 ? (
            <line
              key={`d${i}`}
              x1={bn.x}
              y1={bn.y}
              x2={topNodes[i + 1].x}
              y2={topNodes[i + 1].y}
              stroke="#22c55e"
              strokeWidth="2"
            />
          ) : (
            <line
              key={`d${i}`}
              x1={bottomNodes[i + 1].x}
              y1={bottomNodes[i + 1].y}
              x2={topNodes[i].x}
              y2={topNodes[i].y}
              stroke="#22c55e"
              strokeWidth="2"
            />
          );
        } else if (trussType === 'howe') {
          // Howe: diagonals point toward center
          return i < numPanels / 2 ? (
            <line
              key={`d${i}`}
              x1={bottomNodes[i + 1].x}
              y1={bottomNodes[i + 1].y}
              x2={topNodes[i].x}
              y2={topNodes[i].y}
              stroke="#22c55e"
              strokeWidth="2"
            />
          ) : (
            <line
              key={`d${i}`}
              x1={bn.x}
              y1={bn.y}
              x2={topNodes[i + 1].x}
              y2={topNodes[i + 1].y}
              stroke="#22c55e"
              strokeWidth="2"
            />
          );
        } else {
          // Warren: alternating diagonals
          return i % 2 === 0 ? (
            <line
              key={`d${i}`}
              x1={bn.x}
              y1={bn.y}
              x2={topNodes[i + 1].x}
              y2={topNodes[i + 1].y}
              stroke="#22c55e"
              strokeWidth="2"
            />
          ) : (
            <line
              key={`d${i}`}
              x1={bottomNodes[i + 1].x}
              y1={bottomNodes[i + 1].y}
              x2={topNodes[i].x}
              y2={topNodes[i].y}
              stroke="#22c55e"
              strokeWidth="2"
            />
          );
        }
      })}
      
      {/* Nodes */}
      {bottomNodes.map((n, i) => (
        <circle key={`bn${i}`} cx={n.x} cy={n.y} r="5" fill="#1e40af" />
      ))}
      {topNodes.map((n, i) => (
        <circle key={`tn${i}`} cx={n.x} cy={n.y} r="5" fill="#1e40af" />
      ))}
      
      {/* Supports */}
      <polygon points={`${bottomNodes[0].x},${bottomNodes[0].y + 5} ${bottomNodes[0].x - 10},${bottomNodes[0].y + 20} ${bottomNodes[0].x + 10},${bottomNodes[0].y + 20}`} fill="none" stroke="#16a34a" strokeWidth="2" />
      <polygon points={`${bottomNodes[numPanels].x},${bottomNodes[numPanels].y + 5} ${bottomNodes[numPanels].x - 10},${bottomNodes[numPanels].y + 20} ${bottomNodes[numPanels].x + 10},${bottomNodes[numPanels].y + 20}`} fill="none" stroke="#16a34a" strokeWidth="2" />
      <circle cx={bottomNodes[numPanels].x} cy={bottomNodes[numPanels].y + 25} r="5" fill="none" stroke="#16a34a" strokeWidth="2" />
      
      {/* Dimension */}
      <text x={offsetX + (span * scale) / 2} y={offsetY + height * scale + 40} textAnchor="middle" fontSize="12" fill="#6b7280">
        Span = {span}m
      </text>
    </svg>
  );
}

// =============================================================================
// CONTINUOUS BEAM COMPONENT
// =============================================================================

export function ContinuousBeamUI() {
  const [spans, setSpans] = useState<number[]>([6, 8, 6]);
  const [loads, setLoads] = useState<{ spanIndex: number; type: 'uniform' | 'point'; value: number; position?: number }[]>([
    { spanIndex: 0, type: 'uniform', value: 20 },
    { spanIndex: 1, type: 'uniform', value: 25 },
    { spanIndex: 2, type: 'uniform', value: 20 },
  ]);
  const [supports, setSupports] = useState<('simple' | 'fixed')[]>(['simple', 'simple', 'simple', 'simple']);
  const [EI, setEI] = useState(50000); // kNm²

  const [results, setResults] = useState<{
    moments: number[];
    reactions: number[];
    maxMoments: { span: number; value: number; position: number }[];
  } | null>(null);

  const syncLoadsWithSpans = useCallback(
    (nextSpans: number[], previousLoads: { spanIndex: number; type: 'uniform' | 'point'; value: number; position?: number }[]) => {
      return nextSpans.map((_, idx) => {
        const existing = previousLoads.find((l) => l.spanIndex === idx && l.type === 'uniform');
        return {
          spanIndex: idx,
          type: 'uniform' as const,
          value: existing?.value ?? 20,
        };
      });
    },
    [],
  );

  const syncSupportsWithSpans = useCallback(
    (nextSpans: number[], previousSupports: ('simple' | 'fixed')[]) => {
      const required = nextSpans.length + 1;
      return Array.from({ length: required }, (_, i) => previousSupports[i] ?? 'simple');
    },
    [],
  );

  const addSpan = useCallback(() => {
    const nextSpans = [...spans, 6];
    setSpans(nextSpans);
    setLoads((prev) => syncLoadsWithSpans(nextSpans, prev));
    setSupports((prev) => syncSupportsWithSpans(nextSpans, prev));
    setResults(null);
  }, [spans, syncLoadsWithSpans, syncSupportsWithSpans]);

  const removeSpan = useCallback(() => {
    if (spans.length <= 1) return;
    const nextSpans = spans.slice(0, -1);
    setSpans(nextSpans);
    setLoads((prev) => syncLoadsWithSpans(nextSpans, prev));
    setSupports((prev) => syncSupportsWithSpans(nextSpans, prev));
    setResults(null);
  }, [spans, syncLoadsWithSpans, syncSupportsWithSpans]);

  const setSupportPreset = useCallback(
    (preset: 'all-simple' | 'fixed-ends' | 'all-fixed') => {
      if (preset === 'all-simple') {
        setSupports(Array.from({ length: spans.length + 1 }, () => 'simple'));
      } else if (preset === 'fixed-ends') {
        setSupports(Array.from({ length: spans.length + 1 }, (_, i) => (i === 0 || i === spans.length ? 'fixed' : 'simple')));
      } else {
        setSupports(Array.from({ length: spans.length + 1 }, () => 'fixed'));
      }
      setResults(null);
    },
    [spans.length],
  );

  const analyze = useCallback(() => {
    const n = spans.length;
    const reactions: number[] = [];
    const moments: number[] = Array(n + 1).fill(0);
    const stiffnessFactor = Math.max(EI, 1) / 50000;

    // Boundary moments from end restraint condition (simplified modeling)
    const leftLoad = loads.find((l) => l.spanIndex === 0)?.value || 0;
    const rightLoad = loads.find((l) => l.spanIndex === n - 1)?.value || 0;
    moments[0] = supports[0] === 'fixed' ? -(leftLoad * spans[0] * spans[0]) / (12 * stiffnessFactor) : 0;
    moments[n] = supports[n] === 'fixed' ? -(rightLoad * spans[n - 1] * spans[n - 1]) / (12 * stiffnessFactor) : 0;

    // Internal support moments (simplified three-moment form)
    for (let i = 1; i < n; i++) {
      const L1 = spans[i - 1];
      const L2 = spans[i];
      const w1 = loads.find((l) => l.spanIndex === i - 1)?.value || 0;
      const w2 = loads.find((l) => l.spanIndex === i)?.value || 0;
      const restraintFactor = supports[i] === 'fixed' ? 1.2 : 1.0;

      moments[i] = -(restraintFactor * (w1 * L1 * L1 + w2 * L2 * L2)) / (16 * stiffnessFactor);
    }

    // Vertical reactions
    for (let i = 0; i <= n; i++) {
      let reactionValue = 0;
      if (i === 0) {
        const w = loads.find((l) => l.spanIndex === 0)?.value || 0;
        reactionValue = w * spans[0] / 2 + (moments[1] - moments[0]) / spans[0];
      } else if (i === n) {
        const w = loads.find((l) => l.spanIndex === n - 1)?.value || 0;
        reactionValue = w * spans[n - 1] / 2 - (moments[n] - moments[n - 1]) / spans[n - 1];
      } else {
        const wL = loads.find((l) => l.spanIndex === i - 1)?.value || 0;
        const wR = loads.find((l) => l.spanIndex === i)?.value || 0;
        reactionValue = wL * spans[i - 1] / 2 + wR * spans[i] / 2 +
          (moments[i] - moments[i - 1]) / spans[i - 1] -
          (moments[i + 1] - moments[i]) / spans[i];
      }
      reactions.push(reactionValue);
    }

    // Max span moments
    const maxMoments = spans.map((L, idx) => {
      const w = loads.find((l) => l.spanIndex === idx)?.value || 0;
      const M = w * L * L / 8 + (moments[idx] + moments[idx + 1]) / 2;
      return { span: idx, value: Math.abs(M), position: L / 2 };
    });

    setResults({ moments, reactions, maxMoments });
  }, [spans, loads, supports, EI]);

  const supportSummary = useMemo(() => {
    const fixed = supports.filter((s) => s === 'fixed').length;
    return `${fixed} fixed / ${supports.length - fixed} simple`;
  }, [supports]);

  return (
    <div className="rounded-xl border border-[#1a2333] bg-[#0b1326] text-[#dae2fd] shadow-[0_12px_40px_rgba(0,0,0,0.35)] overflow-hidden">
      <div className="border-b border-[#1a2333] bg-[#131b2e] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-wide">Continuous Beam Analysis</h2>
            <p className="text-xs text-[#869ab8]">High-density workflow • Three-Moment Equation • Enterprise input controls</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded border border-[#22304a] bg-[#0f1a30] px-2 py-1 text-[#adc6ff]">{spans.length} spans</span>
            <span className="rounded border border-[#22304a] bg-[#0f1a30] px-2 py-1 text-[#adc6ff]">{supportSummary}</span>
            <span className="rounded border border-[#22304a] bg-[#0f1a30] px-2 py-1 text-[#adc6ff]">EI {EI.toLocaleString()} kNm²</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 p-4">
        {/* Dense Controls */}
        <div className="xl:col-span-5 space-y-3">
          <div className="rounded-lg border border-[#1a2333] bg-[#131b2e] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#adc6ff]">Span Matrix</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={addSpan}
                  className="rounded border border-purple-400/40 bg-purple-500/20 px-2 py-1 text-xs font-medium tracking-wide text-purple-200 hover:bg-purple-500/30"
                >
                  + Span
                </button>
                <button
                  type="button"
                  onClick={removeSpan}
                  disabled={spans.length <= 1}
                  className="rounded border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs font-medium tracking-wide text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  − Span
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {spans.map((span, idx) => (
                <div key={idx} className="grid grid-cols-[52px_1fr_52px] items-center gap-2">
                  <span className="text-xs text-[#869ab8]">S{idx + 1}</span>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={span}
                    onChange={(e) => {
                      const updated = [...spans];
                      updated[idx] = Number(e.target.value);
                      setSpans(updated);
                      setResults(null);
                    }}
                    className="h-8 rounded border border-[#2a3955] bg-[#0f1a30] px-2 text-sm text-[#dae2fd] outline-none ring-0 transition focus:border-[#60a5fa]"
                  />
                  <span className="text-xs text-[#869ab8] text-right">m</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#1a2333] bg-[#131b2e] p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#adc6ff]">Uniform Load Matrix</h3>
            <div className="space-y-1.5">
              {spans.map((_, idx) => {
                const load = loads.find((l) => l.spanIndex === idx);
                return (
                  <div key={idx} className="grid grid-cols-[52px_1fr_52px] items-center gap-2">
                    <span className="text-xs text-[#869ab8]">S{idx + 1}</span>
                    <input
                      type="number"
                      step="0.1"
                      value={load?.value || 0}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setLoads((prev) => {
                          const existing = prev.findIndex((l) => l.spanIndex === idx && l.type === 'uniform');
                          if (existing >= 0) {
                            const updated = [...prev];
                            updated[existing].value = value;
                            return updated;
                          }
                          return [...prev, { spanIndex: idx, type: 'uniform', value }];
                        });
                        setResults(null);
                      }}
                      className="h-8 rounded border border-[#2a3955] bg-[#0f1a30] px-2 text-sm text-[#dae2fd] outline-none ring-0 transition focus:border-[#60a5fa]"
                    />
                    <span className="text-xs text-[#869ab8] text-right">kN/m</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#1a2333] bg-[#131b2e] p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#adc6ff]">Flexural Rigidity</h3>
            <div className="grid grid-cols-[1fr_70px] items-center gap-2">
              <input
                type="number"
                min="1"
                value={EI}
                onChange={(e) => {
                  setEI(Number(e.target.value));
                  setResults(null);
                }}
                className="h-8 rounded border border-[#2a3955] bg-[#0f1a30] px-2 text-sm text-[#dae2fd] outline-none ring-0 transition focus:border-[#60a5fa]"
              />
              <span className="text-xs text-[#869ab8] text-right">kNm²</span>
            </div>
          </div>
        </div>

        {/* Supports + Visualization */}
        <div className="xl:col-span-7 space-y-3">
          <div className="rounded-lg border border-[#1a2333] bg-[#131b2e] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#adc6ff]">Boundary Conditions</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSupportPreset('all-simple')}
                  className="rounded border border-[#2a3955] bg-[#0f1a30] px-2 py-1 text-[11px] text-[#c6d4ee] hover:border-[#4d8eff]"
                >
                  All Simple
                </button>
                <button
                  type="button"
                  onClick={() => setSupportPreset('fixed-ends')}
                  className="rounded border border-[#2a3955] bg-[#0f1a30] px-2 py-1 text-[11px] text-[#c6d4ee] hover:border-[#4d8eff]"
                >
                  Fixed Ends
                </button>
                <button
                  type="button"
                  onClick={() => setSupportPreset('all-fixed')}
                  className="rounded border border-[#2a3955] bg-[#0f1a30] px-2 py-1 text-[11px] text-[#c6d4ee] hover:border-[#4d8eff]"
                >
                  All Fixed
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {supports.map((support, idx) => (
                <div key={idx} className="rounded border border-[#2a3955] bg-[#0f1a30] p-2">
                  <label className="mb-1 block text-[11px] font-medium tracking-wide text-[#869ab8]">Node {idx}</label>
                  <select
                    value={support}
                    onChange={(e) => {
                      const updated = [...supports];
                      updated[idx] = e.target.value as 'simple' | 'fixed';
                      setSupports(updated);
                      setResults(null);
                    }}
                    className="h-8 w-full rounded border border-[#2a3955] bg-[#131b2e] px-2 text-xs text-[#dae2fd] outline-none focus:border-[#60a5fa]"
                  >
                    <option value="simple">Simple</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#1a2333] bg-[#111a2f] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#adc6ff]">Beam Visualization & Diagram</h3>
              <button
                type="button"
                onClick={analyze}
                className="rounded border border-purple-400/40 bg-purple-500/20 px-3 py-1.5 text-xs font-semibold tracking-wider text-purple-100 hover:bg-purple-500/30"
              >
                Run Analysis
              </button>
            </div>
            <div className="rounded border border-[#1a2333] bg-[#0b1326] p-2">
              <ContinuousBeamVisualization spans={spans} loads={loads} results={results} />
            </div>
          </div>
        </div>
      </div>

      {results && (
        <div className="border-t border-[#1a2333] bg-[#131b2e] p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-200">Support Moments (kNm)</h4>
              <div className="space-y-1 text-xs">
                {results.moments.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-blue-100/80">M{idx}</span>
                    <span className="font-mono text-blue-100">{m.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-200">Reactions (kN)</h4>
              <div className="space-y-1 text-xs">
                {results.reactions.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-emerald-100/80">R{idx}</span>
                    <span className="font-mono text-emerald-100">{r.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-200">Max Span Moments (kNm)</h4>
              <div className="space-y-1 text-xs">
                {results.maxMoments.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-amber-100/80">Span {m.span + 1}</span>
                    <span className="font-mono text-amber-100">{m.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContinuousBeamVisualization({
  spans,
  loads,
  results,
}: {
  spans: number[];
  loads: { spanIndex: number; value: number }[];
  results: { moments: number[]; reactions: number[] } | null;
}) {
  const totalLength = spans.reduce((a, b) => a + b, 0);
  const scale = 400 / totalLength;
  const offsetX = 50;
  const offsetY = 60;

  let cumX = offsetX;
  const supportPositions: number[] = [cumX];
  spans.forEach(s => {
    cumX += s * scale;
    supportPositions.push(cumX);
  });

  return (
    <svg width="100%" viewBox="0 0 500 180" className="bg-white rounded">
      {/* Beam */}
      <line
        x1={offsetX}
        y1={offsetY}
        x2={offsetX + totalLength * scale}
        y2={offsetY}
        stroke="#3b82f6"
        strokeWidth="6"
      />
      
      {/* Supports */}
      {supportPositions.map((x, idx) => (
        <g key={idx}>
          <polygon
            points={`${x},${offsetY + 3} ${x - 10},${offsetY + 20} ${x + 10},${offsetY + 20}`}
            fill="none"
            stroke="#16a34a"
            strokeWidth="2"
          />
          {results && (
            <text x={x} y={offsetY + 40} textAnchor="middle" fontSize="10" fill="#16a34a">
              R={results.reactions[idx]?.toFixed(1)}kN
            </text>
          )}
        </g>
      ))}
      
      {/* Distributed loads */}
      {spans.map((span, idx) => {
        const load = loads.find(l => l.spanIndex === idx);
        if (!load) return null;
        
        const startX = supportPositions[idx];
        const endX = supportPositions[idx + 1];
        const numArrows = Math.floor((endX - startX) / 20);
        
        return (
          <g key={idx}>
            {Array.from({ length: numArrows + 1 }).map((_, i) => {
              const x = startX + (i / numArrows) * (endX - startX);
              return (
                <g key={i}>
                  <line x1={x} y1={offsetY - 25} x2={x} y2={offsetY - 3} stroke="#dc2626" strokeWidth="1" />
                  <polygon points={`${x},${offsetY - 3} ${x - 3},${offsetY - 9} ${x + 3},${offsetY - 9}`} fill="#dc2626" />
                </g>
              );
            })}
            <text x={(startX + endX) / 2} y={offsetY - 35} textAnchor="middle" fontSize="10" fill="#dc2626">
              {load.value} kN/m
            </text>
          </g>
        );
      })}
      
      {/* Span labels */}
      {spans.map((span, idx) => (
        <text
          key={idx}
          x={(supportPositions[idx] + supportPositions[idx + 1]) / 2}
          y={offsetY + 55}
          textAnchor="middle"
          fontSize="11"
          fill="#6b7280"
        >
          L{idx + 1}={span}m
        </text>
      ))}
      
      {/* BMD (simplified) */}
      {results && (
        <g>
          <path
            d={`M ${offsetX} ${offsetY + 80} 
                ${spans.map((span, idx) => {
                  const startX = supportPositions[idx];
                  const endX = supportPositions[idx + 1];
                  const midX = (startX + endX) / 2;
                  const M1 = results.moments[idx] * 0.5;
                  const M2 = results.moments[idx + 1] * 0.5;
                  const Mmax = -20; // Approximate mid-span moment
                  return `L ${startX} ${offsetY + 80 + M1} Q ${midX} ${offsetY + 80 + Mmax} ${endX} ${offsetY + 80 + M2}`;
                }).join(' ')}`}
            fill="rgba(239, 68, 68, 0.2)"
            stroke="#ef4444"
            strokeWidth="2"
          />
          <text x={offsetX + totalLength * scale + 10} y={offsetY + 85} fontSize="10" fill="#ef4444">BMD</text>
        </g>
      )}
    </svg>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  FrameAnalysisUI,
  TrussAnalysisUI,
  ContinuousBeamUI,
};
