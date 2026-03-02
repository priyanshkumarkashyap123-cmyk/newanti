/**
 * PropertyInspector.tsx - Advanced Property Inspector Panel (STAAD.Pro/SkyCiv Style)
 * 
 * Professional property panel with:
 * - Dynamic property groups based on selection
 * - Inline editing with validation
 * - Multi-select property editing
 * - Section/Material pickers
 * - Unit conversion
 * - Property history/undo
 * - Expression input support
 */

import React from 'react';
import { FC, useState, useCallback, useMemo, memo, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, Settings, Box, Circle, Layers, ArrowDown,
  Info, AlertTriangle, Copy, Clipboard, RotateCcw, Lock, Unlock, Link,
  Unlink, Eye, EyeOff, Grid3X3, Target, Anchor, Zap, Edit3, Check, X,
  Plus, Minus, MoreVertical, Search, RefreshCw
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type PropertyType = 
  | 'text' | 'number' | 'boolean' | 'select' | 'color' 
  | 'vector3' | 'matrix' | 'section' | 'material' | 'expression';

export interface PropertyOption {
  value: string | number;
  label: string;
  icon?: React.ElementType;
}

export interface Property {
  id: string;
  label: string;
  type: PropertyType;
  value: any;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  options?: PropertyOption[];
  placeholder?: string;
  readOnly?: boolean;
  linked?: boolean; // For linked properties (e.g., XYZ constraints)
  expression?: string; // For expression-based values
  validation?: (value: any) => string | null;
  onChange?: (value: any) => void;
}

export interface PropertyGroup {
  id: string;
  label: string;
  icon?: React.ElementType;
  collapsed?: boolean;
  properties: Property[];
}

export interface SelectionInfo {
  type: 'none' | 'node' | 'member' | 'plate' | 'load' | 'support' | 'mixed';
  count: number;
  ids: string[];
  commonProperties?: PropertyGroup[];
}

// Derive SelectionType from SelectionInfo
export type SelectionType = SelectionInfo['type'];

interface PropertyInspectorProps {
  selection: SelectionInfo;
  propertyGroups?: PropertyGroup[];
  onPropertyChange?: (propertyId: string, value: any, elementIds: string[]) => void;
  onCopyProperties?: () => void;
  onPasteProperties?: () => void;
  onResetProperties?: () => void;
  showSearch?: boolean;
  compact?: boolean;
}

// ============================================
// SELECTION HEADER
// ============================================

// Static icon mapping to avoid creating components during render
const SELECTION_ICON_MAP: Record<SelectionType, React.FC<{ className?: string }>> = {
  node: Circle,
  member: Layers,
  plate: Box,
  load: ArrowDown,
  support: Anchor,
  mixed: Grid3X3,
  none: Info,
};

const SELECTION_COLOR_MAP: Record<SelectionType, string> = {
  node: 'text-emerald-400',
  member: 'text-blue-400',
  plate: 'text-purple-400',
  load: 'text-red-400',
  support: 'text-orange-400',
  mixed: 'text-amber-400',
  none: 'text-slate-500 dark:text-slate-400',
};

const SelectionHeader: FC<{
  selection: SelectionInfo;
  onCopy?: () => void;
  onPaste?: () => void;
  onReset?: () => void;
}> = memo(({ selection, onCopy, onPaste, onReset }) => {
  // Use static mappings to avoid creating components during render
  const IconComponent = SELECTION_ICON_MAP[selection.type] || Info;
  const iconColor = SELECTION_COLOR_MAP[selection.type] || 'text-slate-500 dark:text-slate-400';

  return (
    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className={`w-4 h-4 ${iconColor}`} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {selection.type === 'none' 
              ? 'No Selection'
              : selection.count === 1
                ? `${selection.type.charAt(0).toUpperCase() + selection.type.slice(1)} ${selection.ids[0]}`
                : `${selection.count} ${selection.type === 'mixed' ? 'Elements' : selection.type + 's'} Selected`
            }
          </span>
        </div>
        
        {selection.type !== 'none' && (
          <div className="flex items-center gap-1">
            <button type="button"
              onClick={onCopy}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
              title="Copy Properties"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={onPaste}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
              title="Paste Properties"
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={onReset}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
              title="Reset Properties"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      
      {selection.type !== 'none' && selection.count > 1 && (
        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
          IDs: {selection.ids.slice(0, 5).join(', ')}{selection.ids.length > 5 ? '...' : ''}
        </div>
      )}
    </div>
  );
});

SelectionHeader.displayName = 'SelectionHeader';

// ============================================
// PROPERTY INPUT COMPONENTS
// ============================================

// Text Input
const TextInput: FC<{
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}> = memo(({ value, placeholder, readOnly, onChange }) => (
  <input
    type="text"
    value={value}
    placeholder={placeholder}
    readOnly={readOnly}
    onChange={(e) => onChange(e.target.value)}
    className={`
      w-full px-2 py-1 text-xs text-right bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded
      text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 
      focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
      ${readOnly ? 'bg-slate-100/50 dark:bg-slate-800/50 cursor-not-allowed' : ''}
    `}
  />
));

TextInput.displayName = 'TextInput';

// Number Input
const NumberInput: FC<{
  value: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  unit?: string;
  readOnly?: boolean;
  onChange: (value: number) => void;
}> = memo(({ value, min, max, step = 1, precision = 3, unit, readOnly, onChange }) => {
  const [localValue, setLocalValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      queueMicrotask(() => setLocalValue(value.toFixed(precision)));
    }
  }, [value, precision, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      let newValue = parsed;
      if (min !== undefined) newValue = Math.max(min, newValue);
      if (max !== undefined) newValue = Math.min(max, newValue);
      onChange(newValue);
      setLocalValue(newValue.toFixed(precision));
    } else {
      setLocalValue(value.toFixed(precision));
    }
  };

  const handleIncrement = (delta: number) => {
    const newValue = value + delta * step;
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, newValue));
    onChange(clamped);
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <input
          type="text"
          value={localValue}
          readOnly={readOnly}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className={`
            w-full px-2 py-1 pr-8 text-xs text-right bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded
            text-slate-700 dark:text-slate-200 font-mono
            focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
            ${readOnly ? 'bg-slate-100/50 dark:bg-slate-800/50 cursor-not-allowed' : ''}
          `}
        />
        {unit && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
      </div>
      {!readOnly && (
        <div className="flex flex-col">
          <button type="button"
            onClick={() => handleIncrement(1)}
            className="p-0.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-t"
          >
            <ChevronDown className="w-3 h-3 rotate-180" />
          </button>
          <button type="button"
            onClick={() => handleIncrement(-1)}
            className="p-0.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-b"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
});

NumberInput.displayName = 'NumberInput';

// Boolean Input
const BooleanInput: FC<{
  value: boolean;
  readOnly?: boolean;
  onChange: (value: boolean) => void;
}> = memo(({ value, readOnly, onChange }) => (
  <button type="button"
    onClick={() => !readOnly && onChange(!value)}
    disabled={readOnly}
    className={`
      w-10 h-5 rounded-full relative transition-colors
      ${value ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}
      ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <motion.div
      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
      animate={{ left: value ? 'calc(100% - 18px)' : '2px' }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
));

BooleanInput.displayName = 'BooleanInput';

// Select Input
const SelectInput: FC<{
  value: string | number;
  options: PropertyOption[];
  readOnly?: boolean;
  onChange: (value: string | number) => void;
}> = memo(({ value, options, readOnly, onChange }) => (
  <select
    value={value}
    disabled={readOnly}
    onChange={(e) => onChange(e.target.value)}
    className={`
      w-full px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded
      text-slate-700 dark:text-slate-200 appearance-none cursor-pointer
      focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
      ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
));

SelectInput.displayName = 'SelectInput';

// Vector3 Input
const Vector3Input: FC<{
  value: { x: number; y: number; z: number };
  unit?: string;
  precision?: number;
  linked?: boolean;
  readOnly?: boolean;
  onChange: (value: { x: number; y: number; z: number }) => void;
  onToggleLinked?: () => void;
}> = memo(({ value, unit, precision = 3, linked = false, readOnly, onChange, onToggleLinked }) => {
  const handleAxisChange = (axis: 'x' | 'y' | 'z', newValue: number) => {
    if (linked) {
      const ratio = value[axis] !== 0 ? newValue / value[axis] : 0;
      onChange({
        x: axis === 'x' ? newValue : value.x * (ratio || 1),
        y: axis === 'y' ? newValue : value.y * (ratio || 1),
        z: axis === 'z' ? newValue : value.z * (ratio || 1),
      });
    } else {
      onChange({ ...value, [axis]: newValue });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1 mb-1">
        {onToggleLinked && (
          <button type="button"
            onClick={onToggleLinked}
            className={`p-0.5 rounded ${linked ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title={linked ? 'Unlink axes' : 'Link axes'}
          >
            {linked ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
          </button>
        )}
      </div>
      {(['x', 'y', 'z'] as const).map(axis => (
        <div key={axis} className="flex items-center gap-2">
          <span className={`w-4 text-xs font-bold ${
            axis === 'x' ? 'text-red-400' : axis === 'y' ? 'text-emerald-400' : 'text-blue-400'
          }`}>
            {axis.toUpperCase()}
          </span>
          <NumberInput
            value={value[axis]}
            precision={precision}
            unit={unit}
            readOnly={readOnly}
            onChange={(v) => handleAxisChange(axis, v)}
          />
        </div>
      ))}
    </div>
  );
});

Vector3Input.displayName = 'Vector3Input';

// Color Input
const ColorInput: FC<{
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}> = memo(({ value, readOnly, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="w-8 h-6 rounded cursor-pointer"
    />
    <input
      type="text"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono"
    />
  </div>
));

ColorInput.displayName = 'ColorInput';

// ============================================
// PROPERTY ROW
// ============================================

const PropertyRow: FC<{
  property: Property;
  onChange: (value: any) => void;
  compact?: boolean;
}> = memo(({ property, onChange, compact }) => {
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((value: any) => {
    if (property.validation) {
      const validationError = property.validation(value);
      setError(validationError);
      if (validationError) return;
    }
    onChange(value);
    property.onChange?.(value);
  }, [property, onChange]);

  const renderInput = () => {
    switch (property.type) {
      case 'text':
        return (
          <TextInput
            value={property.value}
            placeholder={property.placeholder}
            readOnly={property.readOnly}
            onChange={handleChange}
          />
        );
      case 'number':
        return (
          <NumberInput
            value={property.value}
            min={property.min}
            max={property.max}
            step={property.step}
            precision={property.precision}
            unit={property.unit}
            readOnly={property.readOnly}
            onChange={handleChange}
          />
        );
      case 'boolean':
        return (
          <BooleanInput
            value={property.value}
            readOnly={property.readOnly}
            onChange={handleChange}
          />
        );
      case 'select':
        return (
          <SelectInput
            value={property.value}
            options={property.options || []}
            readOnly={property.readOnly}
            onChange={handleChange}
          />
        );
      case 'color':
        return (
          <ColorInput
            value={property.value}
            readOnly={property.readOnly}
            onChange={handleChange}
          />
        );
      case 'vector3':
        return (
          <Vector3Input
            value={property.value}
            unit={property.unit}
            precision={property.precision}
            linked={property.linked}
            readOnly={property.readOnly}
            onChange={handleChange}
          />
        );
      default:
        return (
          <TextInput
            value={String(property.value)}
            readOnly={property.readOnly}
            onChange={handleChange}
          />
        );
    }
  };

  return (
    <div className={`flex items-start gap-2 ${compact ? 'py-1' : 'py-1.5'}`}>
      <label className="flex-shrink-0 w-24 text-xs text-slate-500 dark:text-slate-400 pt-1 truncate" title={property.label}>
        {property.label}
        {property.readOnly && <Lock className="w-2.5 h-2.5 inline ml-1 opacity-50" />}
      </label>
      <div className="flex-1 min-w-0">
        {renderInput()}
        {error && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
});

PropertyRow.displayName = 'PropertyRow';

// ============================================
// PROPERTY GROUP
// ============================================

const PropertyGroupComponent: FC<{
  group: PropertyGroup;
  onPropertyChange: (propertyId: string, value: any) => void;
  compact?: boolean;
}> = memo(({ group, onPropertyChange, compact }) => {
  const [isExpanded, setIsExpanded] = useState(!group.collapsed);
  const Icon = group.icon || Settings;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      {/* Group Header */}
      <button type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        )}
        <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          {group.label}
        </span>
      </button>

      {/* Properties */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2">
              {group.properties.map(property => (
                <PropertyRow
                  key={property.id}
                  property={property}
                  onChange={(value) => onPropertyChange(property.id, value)}
                  compact={compact}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

PropertyGroupComponent.displayName = 'PropertyGroupComponent';

// ============================================
// MAIN PROPERTY INSPECTOR
// ============================================

export const PropertyInspector: FC<PropertyInspectorProps> = ({
  selection,
  propertyGroups,
  onPropertyChange,
  onCopyProperties,
  onPasteProperties,
  onResetProperties,
  showSearch = true,
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter properties based on search
  const filteredGroups = useMemo(() => {
    if (!propertyGroups || !searchQuery) return propertyGroups;

    const query = searchQuery.toLowerCase();
    return propertyGroups
      .map(group => ({
        ...group,
        properties: group.properties.filter(prop =>
          prop.label.toLowerCase().includes(query) ||
          prop.id.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.properties.length > 0);
  }, [propertyGroups, searchQuery]);

  const handlePropertyChange = useCallback((propertyId: string, value: any) => {
    onPropertyChange?.(propertyId, value, selection.ids);
  }, [onPropertyChange, selection.ids]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Properties</h2>
      </div>

      {/* Selection Info */}
      <SelectionHeader
        selection={selection}
        onCopy={onCopyProperties}
        onPaste={onPasteProperties}
        onReset={onResetProperties}
      />

      {/* Search */}
      {showSearch && propertyGroups && propertyGroups.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search properties..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Property Groups */}
      <div className="flex-1 overflow-y-auto">
        {selection.type === 'none' ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
            <Info className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">Select an element to view properties</p>
          </div>
        ) : filteredGroups && filteredGroups.length > 0 ? (
          filteredGroups.map(group => (
            <PropertyGroupComponent
              key={group.id}
              group={group}
              onPropertyChange={handlePropertyChange}
              compact={compact}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">No properties match your search</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {selection.type !== 'none' && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>{filteredGroups?.reduce((sum, g) => sum + g.properties.length, 0) || 0} properties</span>
            <button type="button" className="text-blue-400 hover:text-blue-300">
              Edit All...
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// DEFAULT PROPERTY GROUPS
// ============================================

export const createNodePropertyGroups = (node: {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: { fx: boolean; fy: boolean; fz: boolean; mx: boolean; my: boolean; mz: boolean };
}): PropertyGroup[] => [
  {
    id: 'node-info',
    label: 'Node Information',
    icon: Circle,
    properties: [
      { id: 'node-id', label: 'Node ID', type: 'text', value: node.id, readOnly: true },
    ]
  },
  {
    id: 'node-coordinates',
    label: 'Coordinates',
    icon: Target,
    properties: [
      { id: 'node-x', label: 'X', type: 'number', value: node.x, unit: 'm', precision: 3 },
      { id: 'node-y', label: 'Y', type: 'number', value: node.y, unit: 'm', precision: 3 },
      { id: 'node-z', label: 'Z', type: 'number', value: node.z, unit: 'm', precision: 3 },
    ]
  },
  ...(node.restraints ? [{
    id: 'node-restraints',
    label: 'Restraints',
    icon: Anchor,
    properties: [
      { id: 'node-fx', label: 'Fix X', type: 'boolean' as PropertyType, value: node.restraints.fx },
      { id: 'node-fy', label: 'Fix Y', type: 'boolean' as PropertyType, value: node.restraints.fy },
      { id: 'node-fz', label: 'Fix Z', type: 'boolean' as PropertyType, value: node.restraints.fz },
      { id: 'node-mx', label: 'Fix Rx', type: 'boolean' as PropertyType, value: node.restraints.mx },
      { id: 'node-my', label: 'Fix Ry', type: 'boolean' as PropertyType, value: node.restraints.my },
      { id: 'node-mz', label: 'Fix Rz', type: 'boolean' as PropertyType, value: node.restraints.mz },
    ]
  }] : [])
];

export const createMemberPropertyGroups = (member: {
  id: string;
  startNode: string;
  endNode: string;
  section?: string;
  material?: string;
  length?: number;
  rotation?: number;
}): PropertyGroup[] => [
  {
    id: 'member-info',
    label: 'Member Information',
    icon: Layers,
    properties: [
      { id: 'member-id', label: 'Member ID', type: 'text', value: member.id, readOnly: true },
      { id: 'member-start', label: 'Start Node', type: 'text', value: member.startNode, readOnly: true },
      { id: 'member-end', label: 'End Node', type: 'text', value: member.endNode, readOnly: true },
      { id: 'member-length', label: 'Length', type: 'number', value: member.length || 0, unit: 'm', readOnly: true, precision: 3 },
    ]
  },
  {
    id: 'member-section',
    label: 'Section & Material',
    icon: Grid3X3,
    properties: [
      { 
        id: 'member-section', 
        label: 'Section', 
        type: 'select', 
        value: member.section || '',
        options: [
          { value: '', label: 'Select Section...' },
          { value: 'ISMB300', label: 'ISMB 300' },
          { value: 'ISMB400', label: 'ISMB 400' },
          { value: 'ISMB500', label: 'ISMB 500' },
          { value: 'ISMC200', label: 'ISMC 200' },
        ]
      },
      { 
        id: 'member-material', 
        label: 'Material', 
        type: 'select', 
        value: member.material || '',
        options: [
          { value: '', label: 'Select Material...' },
          { value: 'steel-fe250', label: 'Steel Fe 250' },
          { value: 'steel-fe415', label: 'Steel Fe 415' },
          { value: 'concrete-m25', label: 'Concrete M25' },
        ]
      },
    ]
  },
  {
    id: 'member-orientation',
    label: 'Orientation',
    icon: RotateCcw,
    properties: [
      { id: 'member-rotation', label: 'Beta Angle', type: 'number', value: member.rotation || 0, unit: '°', precision: 1 },
    ]
  }
];

export default PropertyInspector;
