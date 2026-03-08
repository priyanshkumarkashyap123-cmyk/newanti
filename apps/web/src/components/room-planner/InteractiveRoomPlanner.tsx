/**
 * Interactive Room Planner Component
 * 
 * Main canvas-based room editor with real-time validation
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CanvasRenderer, type RenderOptions } from '@/lib/room-planner/renderer';
import { CanvasInteractionManager, type InteractionEvent } from '@/lib/room-planner/interaction';
import { ValidationEngine } from '@/lib/room-planner/validation';
import type { CanvasState, CanvasToolMode, Room, FurnitureItem, ValidationResult } from '@/lib/room-planner/types';

interface InteractiveRoomPlannerProps {
  onStateChange?: (state: CanvasState) => void;
  onValidationChange?: (result: ValidationResult) => void;
  initialState?: CanvasState;
}

export const InteractiveRoomPlanner: React.FC<InteractiveRoomPlannerProps> = ({
  onStateChange,
  onValidationChange,
  initialState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<CanvasState>(
    initialState || {
      rooms: [
        {
          id: 'room_1',
          name: 'Living Room',
          x: 0,
          y: 0,
          width: 5000, // 5m in mm
          height: 4000, // 4m
          color: '#E8F4F8',
          wallThickness: 150,
          roomType: 'living',
        },
      ],
      doors: [],
      windows: [],
      furniture: [],
      walkPaths: [],
      selection: { type: 'none', isDragging: false },
      toolMode: 'select' as CanvasToolMode,
      zoom: 100,
      panX: 100,
      panY: 100,
      showGrid: true,
      gridSpacing: 200,
      snapToGrid: true,
    }
  );

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const rendererRef = useRef<CanvasRenderer | null>(null);
  const interactionRef = useRef<CanvasInteractionManager | null>(null);
  const validationRef = useRef<ValidationEngine>(new ValidationEngine());

  // Initialize canvas and managers
  useEffect(() => {
    if (!canvasRef.current) return;

    // Set canvas size
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    canvasRef.current.width = width;
    canvasRef.current.height = height;

    // Create renderer
    rendererRef.current = new CanvasRenderer(canvasRef.current, {
      showGrid: state.showGrid,
      showDimensions: true,
      showDoorSwings: true,
      showValidationHighlights: true,
      pixelsPerMm: state.zoom / 100 * 0.1,
      panX: state.panX,
      panY: state.panY,
    });

    // Create interaction manager
    interactionRef.current = new CanvasInteractionManager(state, {
      onInteraction: handleInteraction,
      onStateChange: handleStateChange,
    });

    // Update viewport
    interactionRef.current.setViewport(state.zoom / 100 * 0.1, state.panX, state.panY);

    // Initial render
    const validation = validationRef.current.validate(state);
    setValidationResult(validation);
    onValidationChange?.(validation);
    rendererRef.current.render(state, validation.issues);
  }, []);

  // Re-render on state change
  useEffect(() => {
    if (!rendererRef.current || !canvasRef.current) return;

    const validation = validationRef.current.validate(state);
    setValidationResult(validation);
    onValidationChange?.(validation);

    rendererRef.current.updateOptions({
      pixelsPerMm: state.zoom / 100 * 0.1,
      panX: state.panX,
      panY: state.panY,
    });

    rendererRef.current.render(state, validation.issues);
  }, [state]);

  const handleInteraction = (event: InteractionEvent): void => {
    console.log('Interaction:', event);
  };

  const handleStateChange = (newState: CanvasState): void => {
    setState(newState);
    onStateChange?.(newState);
  };

  // Canvas event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionRef.current?.handleMouseDown(e.nativeEvent, canvasRef.current!);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionRef.current?.handleMouseMove(e.nativeEvent, canvasRef.current!);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionRef.current?.handleMouseUp(e.nativeEvent, canvasRef.current!);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    interactionRef.current?.handleDoubleClick(e.nativeEvent, canvasRef.current!);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        interactionRef.current?.deleteSelected();
      }
      if (e.key === 'g') {
        setState(prev => ({ ...prev, showGrid: !prev.showGrid }));
      }
      if (e.key === '+' || e.key === '=') {
        setState(prev => ({
          ...prev,
          zoom: Math.min(200, prev.zoom + 10),
        }));
      }
      if (e.key === '-') {
        setState(prev => ({
          ...prev,
          zoom: Math.max(50, prev.zoom - 10),
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      rendererRef.current?.resize(width, height);
      if (rendererRef.current) {
        const validation = validationRef.current.validate(state);
        rendererRef.current.render(state, validation.issues);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-100 overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onDoubleClick={handleCanvasDoubleClick}
        className="w-full h-full cursor-crosshair bg-white"
        style={{ display: 'block' }}
      />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3 flex gap-2">
        <button
          onClick={() => setState(prev => ({ ...prev, toolMode: 'select' }))}
          className={`px-3 py-2 rounded ${state.toolMode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          title="Select (S)"
        >
          Select
        </button>
        <button
          onClick={() => setState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
          className={`px-3 py-2 rounded ${state.showGrid ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          title="Toggle Grid (G)"
        >
          Grid
        </button>
        <button
          onClick={() => setState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
          className={`px-3 py-2 rounded ${state.snapToGrid ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          title="Snap to Grid"
        >
          Snap
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 flex gap-2">
        <button
          onClick={() => setState(prev => ({ ...prev, zoom: Math.max(50, prev.zoom - 10) }))}
          className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
          title="Zoom Out (-)"
        >
          -
        </button>
        <span className="px-4 py-2 text-sm">{state.zoom}%</span>
        <button
          onClick={() => setState(prev => ({ ...prev, zoom: Math.min(200, prev.zoom + 10) }))}
          className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
          title="Zoom In (+)"
        >
          +
        </button>
      </div>

      {/* Validation Summary */}
      {validationResult && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-4 w-80">
          <h3 className="font-bold mb-2">
            {validationResult.passed ? '✅ Valid Layout' : '⚠️ Issues Found'}
          </h3>
          
          {validationResult.issues.length === 0 ? (
            <p className="text-sm text-gray-600">No issues detected</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {validationResult.issues.map((issue, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded ${
                    issue.severity === 'error'
                      ? 'bg-red-100 text-red-800'
                      : issue.severity === 'warning'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  <strong>{issue.severity.toUpperCase()}: </strong>
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Bar */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-md px-4 py-2 text-xs text-gray-600">
        <p>
          Rooms: {state.rooms.length} | Doors: {state.doors.length} | Furniture:{' '}
          {state.furniture.length}
        </p>
        {state.selection.objectId && (
          <p className="text-blue-600">
            Selected: {state.selection.objectId.substring(0, 20)}...
          </p>
        )}
      </div>
    </div>
  );
};

export default InteractiveRoomPlanner;
