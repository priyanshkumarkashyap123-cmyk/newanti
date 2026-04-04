/**
 * Furniture Palette Sidebar
 * 
 * Displays furniture library categorized by type
 * Supports drag-and-drop placement
 */

'use client';

import React, { useState } from 'react';
import { FURNITURE_DIMENSIONS, type FurnitureCategory, type FurnitureType } from '@/lib/room-planner/types';

interface FurniturePaletteProps {
  onFurnitureSelect: (type: FurnitureType) => void;
  selectedCategory?: FurnitureCategory;
  selectedFurnitureType?: FurnitureType | null;
  onCategoryChange?: (category: FurnitureCategory) => void;
}

const CATEGORIES: { value: FurnitureCategory; label: string }[] = [
  { value: 'bed', label: 'Beds' },
  { value: 'seating', label: 'Seating' },
  { value: 'dining', label: 'Dining' },
  { value: 'storage', label: 'Storage' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'office', label: 'Office' },
  { value: 'decor', label: 'Decor' },
];

export const FurniturePalette: React.FC<FurniturePaletteProps> = ({
  onFurnitureSelect,
  selectedCategory = 'seating',
  selectedFurnitureType,
  onCategoryChange,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [dragSource, setDragSource] = useState<string | null>(null);

  // Get furniture items for selected category
  const getFurnitureForCategory = (category: FurnitureCategory) => {
    return Object.entries(FURNITURE_DIMENSIONS)
      .filter(([_, dims]) => dims.category === category)
      .map(([type]) => type as FurnitureType);
  };

  const currentFurniture = getFurnitureForCategory(selectedCategory);

  const handleDragStart = (type: FurnitureType, e: React.DragEvent) => {
    setDragSource(type);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('furnitureType', type);
  };

  const handleCategoryClick = (category: FurnitureCategory) => {
    onCategoryChange?.(category);
  };

  const formatName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getDimensions = (type: FurnitureType) => {
    const dims = FURNITURE_DIMENSIONS[type];
    return `${(dims.width / 1000).toFixed(1)}m × ${(dims.depth / 1000).toFixed(1)}m`;
  };

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg text-gray-900">Furniture</h2>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            {expanded ? '−' : '+'}
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => handleCategoryClick(cat.value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Furniture List */}
      {expanded && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {currentFurniture.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No furniture in this category</p>
          ) : (
            currentFurniture.map(type => {
              const dims = FURNITURE_DIMENSIONS[type];
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={e => handleDragStart(type, e)}
                  onDragEnd={() => setDragSource(null)}
                  onClick={() => onFurnitureSelect(type)}
                  className={`p-3 rounded-lg border-2 cursor-move transition-all ${
                    dragSource === type || selectedFurnitureType === type
                      ? 'border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="mb-2 w-full h-20 bg-gradient-to-br from-amber-100 to-amber-200 rounded border border-amber-300 flex items-center justify-center overflow-hidden">
                    <svg
                      width="60"
                      height="60"
                      viewBox={`0 0 ${dims.width} ${dims.depth}`}
                      className="opacity-60"
                    >
                      <rect
                        x="5"
                        y="5"
                        width={dims.width - 10}
                        height={dims.depth - 10}
                        fill="#D97706"
                        stroke="#92400E"
                        strokeWidth="2"
                        rx="2"
                      />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">{formatName(type)}</p>
                    <p className="text-xs text-gray-600">{getDimensions(type)}</p>
                    <p className="text-xs text-gray-500 mt-1">Drag to place • Click to select</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer Help */}
      <div className="p-3 bg-blue-50 border-t border-gray-200 text-xs text-gray-700">
        <p className="font-semibold mb-1">💡 Tip:</p>
        <ul className="space-y-1">
          <li>• Drag furniture onto canvas to place</li>
          <li>• Double-click to rotate 90°</li>
          <li>• Delete key to remove</li>
          <li>• Grid snap for alignment</li>
        </ul>
      </div>
    </div>
  );
};

export default FurniturePalette;
