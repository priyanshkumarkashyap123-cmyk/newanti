/**
 * Room Planner Page
 * 
 * Full-page interactive room planning tool
 */

'use client';

import React, { useState } from 'react';
import InteractiveRoomPlanner from '@/components/room-planner/InteractiveRoomPlanner';
import FurniturePalette from '@/components/room-planner/FurniturePalette';
import ValidationPanel from '@/components/room-planner/ValidationPanel';
import type {
  CanvasState,
  FurnitureCategory,
  FurnitureType,
  ValidationResult,
} from '@/lib/room-planner/types';

export default function RoomPlannerPage() {
  const [state, setState] = useState<CanvasState | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedFurnitureCategory, setSelectedFurnitureCategory] =
    useState<FurnitureCategory>('seating');
  const [pendingFurnitureType, setPendingFurnitureType] = useState<FurnitureType | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const escapeXml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const generateRoomPlanSvg = (canvasState: CanvasState) => {
    const itemsBounds = [
      ...canvasState.rooms.map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })),
      ...canvasState.furniture.map((f) => ({ x: f.x, y: f.y, w: f.width, h: f.depth })),
    ];

    const minX = itemsBounds.length ? Math.min(...itemsBounds.map((b) => b.x)) : 0;
    const minY = itemsBounds.length ? Math.min(...itemsBounds.map((b) => b.y)) : 0;
    const maxX = itemsBounds.length ? Math.max(...itemsBounds.map((b) => b.x + b.w)) : 5000;
    const maxY = itemsBounds.length ? Math.max(...itemsBounds.map((b) => b.y + b.h)) : 4000;

    const padding = 200;
    const viewX = minX - padding;
    const viewY = minY - padding;
    const viewW = maxX - minX + padding * 2;
    const viewH = maxY - minY + padding * 2;

    const roomElements = canvasState.rooms
      .map(
        (room) => `
      <g>
        <rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.height}" fill="${room.color}" stroke="#1f2937" stroke-width="40"/>
        <text x="${room.x + room.width / 2}" y="${room.y + room.height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="140" fill="#111827" font-family="Arial, sans-serif">${escapeXml(room.name)}</text>
      </g>`,
      )
      .join('');

    const furnitureElements = canvasState.furniture
      .map(
        (furniture) => `
      <g>
        <rect x="${furniture.x}" y="${furniture.y}" width="${furniture.width}" height="${furniture.depth}" fill="${furniture.color}" fill-opacity="0.75" stroke="#4b5563" stroke-width="20" rx="20"/>
        <text x="${furniture.x + furniture.width / 2}" y="${furniture.y + furniture.depth / 2}" text-anchor="middle" dominant-baseline="middle" font-size="90" fill="#111827" font-family="Arial, sans-serif">${escapeXml(furniture.label || furniture.type.replace(/_/g, ' '))}</text>
      </g>`,
      )
      .join('');

    const doorElements = canvasState.doors
      .map(
        (door) =>
          `<line x1="${door.x - door.width / 2}" y1="${door.y}" x2="${door.x + door.width / 2}" y2="${door.y}" stroke="#0f766e" stroke-width="28"/>`,
      )
      .join('');

    const windowElements = canvasState.windows
      .map(
        (windowObj) =>
          `<line x1="${windowObj.x - windowObj.width / 2}" y1="${windowObj.y}" x2="${windowObj.x + windowObj.width / 2}" y2="${windowObj.y}" stroke="#2563eb" stroke-width="24"/>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewX} ${viewY} ${viewW} ${viewH}">
  <rect x="${viewX}" y="${viewY}" width="${viewW}" height="${viewH}" fill="#f8fafc"/>
  ${roomElements}
  ${furnitureElements}
  ${doorElements}
  ${windowElements}
</svg>`;
  };

  const handleStateChange = (newState: CanvasState) => {
    setState(newState);
  };

  const handleValidationChange = (result: ValidationResult) => {
    setValidationResult(result);
  };

  const handleFurnitureSelect = (type: FurnitureType) => {
    setPendingFurnitureType(type);
  };

  const clearPendingFurniture = () => {
    setPendingFurnitureType(null);
  };

  const handleExportJSON = () => {
    if (!state) return;
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    triggerDownload(blob, `room-plan-${Date.now()}.json`);
  };

  const handleExportSVG = () => {
    if (!state) return;
    const svg = generateRoomPlanSvg(state);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `room-plan-${Date.now()}.svg`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar - Furniture Palette */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 overflow-hidden">
        <FurniturePalette
          onFurnitureSelect={handleFurnitureSelect}
          selectedCategory={selectedFurnitureCategory}
          selectedFurnitureType={pendingFurnitureType}
          onCategoryChange={setSelectedFurnitureCategory}
        />
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Room Planner</h1>
            <p className="text-sm text-gray-400">Interactive space layout designer</p>
          </div>

          <div className="flex items-center gap-3">
            {pendingFurnitureType && (
              <div className="px-3 py-2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
                <span>
                  Placing: <strong>{pendingFurnitureType.replace(/_/g, ' ')}</strong>
                </span>
                <button
                  onClick={clearPendingFurniture}
                  className="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/50"
                  title="Cancel placement"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Info */}
            {state && (
              <div className="text-sm">
                <p>
                  <strong>Rooms:</strong> {state.rooms.length}
                </p>
                <p>
                  <strong>Furniture:</strong> {state.furniture.length}
                </p>
              </div>
            )}

            {/* Export Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Export
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded shadow-lg z-10">
                  <button
                    onClick={() => {
                      handleExportJSON();
                      setShowExportMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-600 first:rounded-t"
                  >
                    📄 Export as JSON
                  </button>
                  <button
                    onClick={() => {
                      handleExportSVG();
                      setShowExportMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-600"
                  >
                    🎨 Export as SVG
                  </button>
                  <button
                    onClick={() => {
                      handlePrint();
                      setShowExportMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-600 last:rounded-b"
                  >
                    🖨️ Print
                  </button>
                </div>
              )}
            </div>

            {/* Help */}
            <button
              onClick={() => setShowHelpPanel((prev) => !prev)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              ?
            </button>
          </div>
        </div>

        {showHelpPanel && (
          <div className="mx-4 mt-3 p-3 rounded border border-gray-700 bg-gray-800 text-xs text-gray-200">
            <p className="font-semibold mb-2">Keyboard Shortcuts</p>
            <ul className="space-y-1 text-gray-300">
              <li><strong>Delete</strong>: Remove selected item</li>
              <li><strong>G</strong>: Toggle grid</li>
              <li><strong>+ / -</strong>: Zoom in/out</li>
              <li><strong>Double-click</strong>: Rotate selected furniture</li>
              <li><strong>Esc</strong>: Cancel pending furniture placement</li>
            </ul>
          </div>
        )}

        {/* Canvas + Validation Area */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Main Canvas */}
          <div className="flex-1 rounded-lg overflow-hidden shadow-lg border border-gray-700">
            <InteractiveRoomPlanner
              onStateChange={handleStateChange}
              onValidationChange={handleValidationChange}
              pendingFurnitureType={pendingFurnitureType}
              onFurniturePlaced={() => setPendingFurnitureType(null)}
              onPlacementCancel={clearPendingFurniture}
            />
          </div>

          {/* Right Sidebar - Validation Panel */}
          <div className="w-96">
            <ValidationPanel result={validationResult} />
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-xs text-gray-400 flex justify-between">
          <div>
            <span>Room Planner v1.0</span>
            {validationResult && (
              <span className="ml-4">
                {validationResult.passed ? '✅ Layout Valid' : `⚠️ ${validationResult.issues.length} Issues`}
              </span>
            )}
          </div>
          <div>Canvas ready • Scale per 200mm grid</div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white;
            color: black;
          }
          .flex.h-screen {
            height: auto;
            display: block;
          }
          .w-72, .w-96, [class*="bg-gray-"], [class*="bg-blue-"] {
            display: none;
          }
          canvas {
            max-width: 100%;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
