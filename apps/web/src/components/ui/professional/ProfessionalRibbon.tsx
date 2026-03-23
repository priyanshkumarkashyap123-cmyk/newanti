/**
 * ProfessionalRibbon.tsx - STAAD.Pro/SkyCiv Style Ribbon Interface
 * 
 * Enterprise-grade ribbon toolbar with:
 * - Tabbed interface with visual category indicators
 * - Large & small tool buttons with icons
 * - Dropdown menus and split buttons
 * - Quick Access Toolbar (QAT)
 * - Contextual tabs that appear based on selection
 * - Keyboard shortcut support
 * - Responsive collapse behavior
 */

import React from 'react';
import { FC, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  // File Operations
  Save, FolderOpen, Download, Upload, FileText, Printer, History,
  // Geometry Tools
  Plus, Box, Grid3X3, Circle, Pentagon, Triangle, Spline, Move3d,
  // Selection
  MousePointer2, Square, Lasso, BoxSelect, Target,
  // Edit
  Copy, Clipboard, Scissors, Trash2, RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
  // View
  Eye, EyeOff, ZoomIn, ZoomOut, Maximize2, Grid, Layers, Camera,
  // Analysis
  Play, Pause, StopCircle, Activity, Cpu, Gauge, Zap,
  // Results
  BarChart3, LineChart, TrendingUp, Table2, FileSpreadsheet,
  // Design
  Ruler, Pencil, Settings2, Wrench, Shield, CheckCircle2,
  // Support
  Anchor, Lock, Unlock, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  // Loads
  Weight, Wind, Snowflake, Waves, Car, Building2,
  // UI
  ChevronDown, ChevronRight, MoreHorizontal, Pin, PinOff, Search,
  Undo, Redo, HelpCircle, Info, AlertTriangle, Home, Sparkles
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface RibbonTool {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  tooltip?: string;
  disabled?: boolean;
  badge?: string | number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

interface ToolDropdownItem extends RibbonTool {
  divider?: boolean;
}

interface RibbonToolWithDropdown extends RibbonTool {
  dropdown?: ToolDropdownItem[];
  splitButton?: boolean;
}

interface RibbonGroup {
  id: string;
  label: string;
  tools: RibbonToolWithDropdown[];
  collapsed?: boolean;
}

interface RibbonTab {
  id: string;
  label: string;
  icon?: React.ElementType;
  groups: RibbonGroup[];
  contextual?: boolean;
  color?: string;
}

interface ProfessionalRibbonProps {
  activeTab?: string;
  activeTool?: string;
  onTabChange?: (tabId: string) => void;
  onToolSelect?: (toolId: string) => void;
  onAction?: (action: string, payload?: any) => void;
  projectName?: string;
  isAnalyzing?: boolean;
  hasUnsavedChanges?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// ============================================
// RIBBON TAB DEFINITIONS
// ============================================

const RIBBON_TABS: RibbonTab[] = [
  {
    id: 'file',
    label: 'File',
    icon: Home,
    groups: [
      {
        id: 'project',
        label: 'Project',
        tools: [
          { 
            id: 'new', label: 'New', icon: FileText, shortcut: 'Ctrl+N',
            dropdown: [
              { id: 'new-blank', label: 'Blank Project', icon: FileText },
              { id: 'new-template', label: 'From Template...', icon: Grid3X3 },
              { id: 'new-import', label: 'Import...', icon: Upload, divider: true },
            ]
          },
          { id: 'open', label: 'Open', icon: FolderOpen, shortcut: 'Ctrl+O' },
          { id: 'save', label: 'Save', icon: Save, shortcut: 'Ctrl+S', variant: 'primary' },
        ]
      },
      {
        id: 'export',
        label: 'Export',
        tools: [
          { 
            id: 'export', label: 'Export', icon: Download,
            dropdown: [
              { id: 'export-pdf', label: 'PDF Report', icon: FileText },
              { id: 'export-excel', label: 'Excel Spreadsheet', icon: FileSpreadsheet },
              { id: 'export-dxf', label: 'DXF/DWG', icon: Box },
              { id: 'export-ifc', label: 'IFC (BIM)', icon: Building2 },
            ]
          },
          { id: 'print', label: 'Print', icon: Printer, shortcut: 'Ctrl+P' },
        ]
      },
      {
        id: 'history',
        label: 'History',
        tools: [
          { id: 'undo', label: 'Undo', icon: Undo, shortcut: 'Ctrl+Z' },
          { id: 'redo', label: 'Redo', icon: Redo, shortcut: 'Ctrl+Y' },
          { id: 'history', label: 'History', icon: History },
        ]
      }
    ]
  },
  {
    id: 'geometry',
    label: 'Geometry',
    icon: Box,
    groups: [
      {
        id: 'selection',
        label: 'Selection',
        tools: [
          { id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V' },
          { 
            id: 'select-mode', label: 'Mode', icon: BoxSelect,
            dropdown: [
              { id: 'select-single', label: 'Single Select', icon: MousePointer2 },
              { id: 'select-box', label: 'Box Select', icon: Square },
              { id: 'select-lasso', label: 'Lasso Select', icon: Lasso },
              { id: 'select-all', label: 'Select All', icon: BoxSelect, shortcut: 'Ctrl+A' },
            ]
          },
        ]
      },
      {
        id: 'create',
        label: 'Create',
        tools: [
          { id: 'node', label: 'Node', icon: Circle, shortcut: 'N', tooltip: 'Create structural node' },
          { id: 'beam', label: 'Beam', icon: Spline, shortcut: 'B', tooltip: 'Draw beam member' },
          { id: 'column', label: 'Column', icon: ArrowUp, shortcut: 'C', tooltip: 'Create column' },
          { 
            id: 'element-more', label: 'More', icon: ChevronDown,
            dropdown: [
              { id: 'plate', label: 'Plate/Shell', icon: Grid3X3, shortcut: 'P' },
              { id: 'truss', label: 'Truss Member', icon: Triangle },
              { id: 'cable', label: 'Cable', icon: Spline },
              { id: 'spring', label: 'Spring', icon: Activity },
            ]
          },
        ]
      },
      {
        id: 'generators',
        label: 'Generators',
        tools: [
          { id: 'wizard', label: 'Structure\nWizard', icon: Sparkles, variant: 'primary' },
          { 
            id: 'generate', label: 'Generate', icon: Grid3X3,
            dropdown: [
              { id: 'gen-frame', label: 'Frame Structure', icon: Grid3X3 },
              { id: 'gen-truss', label: 'Truss Structure', icon: Triangle },
              { id: 'gen-grid', label: 'Grid Structure', icon: Grid },
              { id: 'gen-cylinder', label: 'Cylindrical', icon: Circle },
            ]
          },
          { id: 'gallery', label: 'Gallery', icon: Building2, tooltip: 'Load famous structures' },
        ]
      },
      {
        id: 'edit',
        label: 'Edit',
        tools: [
          { id: 'move', label: 'Move', icon: Move3d, shortcut: 'M' },
          { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C' },
          { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del' },
          { 
            id: 'transform', label: 'Transform', icon: RotateCcw,
            dropdown: [
              { id: 'rotate', label: 'Rotate', icon: RotateCcw, shortcut: 'R' },
              { id: 'mirror-x', label: 'Mirror X', icon: FlipHorizontal },
              { id: 'mirror-y', label: 'Mirror Y', icon: FlipVertical },
              { id: 'scale', label: 'Scale', icon: Maximize2 },
              { id: 'array', label: 'Array...', icon: Grid3X3, divider: true },
            ]
          },
        ]
      },
    ]
  },
  {
    id: 'properties',
    label: 'Properties',
    icon: Settings2,
    groups: [
      {
        id: 'sections',
        label: 'Sections',
        tools: [
          { 
            id: 'assign-section', label: 'Assign\nSection', icon: Box, variant: 'primary',
            dropdown: [
              { id: 'section-ismc', label: 'ISMC (Channel)', icon: Box },
              { id: 'section-ismb', label: 'ISMB (I-Beam)', icon: Box },
              { id: 'section-tube', label: 'Tube/Pipe', icon: Circle },
              { id: 'section-angle', label: 'Angle', icon: Triangle },
              { id: 'section-custom', label: 'Custom Section...', icon: Pencil, divider: true },
            ]
          },
          { id: 'section-db', label: 'Section\nDatabase', icon: Table2 },
          { id: 'section-builder', label: 'Section\nBuilder', icon: Pencil },
        ]
      },
      {
        id: 'materials',
        label: 'Materials',
        tools: [
          { 
            id: 'assign-material', label: 'Assign\nMaterial', icon: Layers,
            dropdown: [
              { id: 'mat-steel', label: 'Structural Steel', icon: Box },
              { id: 'mat-concrete', label: 'Concrete', icon: Grid3X3 },
              { id: 'mat-aluminum', label: 'Aluminum', icon: Box },
              { id: 'mat-timber', label: 'Timber', icon: Box },
              { id: 'mat-custom', label: 'Custom...', icon: Pencil, divider: true },
            ]
          },
          { id: 'material-db', label: 'Material\nDatabase', icon: Table2 },
        ]
      },
      {
        id: 'releases',
        label: 'Member Properties',
        tools: [
          { id: 'releases', label: 'End\nReleases', icon: Unlock, tooltip: 'Member end releases' },
          { id: 'beta-angle', label: 'Beta\nAngle', icon: RotateCcw },
          { id: 'offsets', label: 'Rigid\nOffsets', icon: Move3d },
        ]
      },
    ]
  },
  {
    id: 'supports',
    label: 'Supports',
    icon: Anchor,
    groups: [
      {
        id: 'boundary',
        label: 'Boundary Conditions',
        tools: [
          { id: 'fixed', label: 'Fixed', icon: Lock, variant: 'success', tooltip: 'Fully fixed support' },
          { id: 'pinned', label: 'Pinned', icon: Circle, tooltip: 'Pinned support' },
          { id: 'roller', label: 'Roller', icon: ArrowRight, tooltip: 'Roller support' },
          { 
            id: 'support-more', label: 'More', icon: ChevronDown,
            dropdown: [
              { id: 'spring-support', label: 'Spring Support', icon: Activity },
              { id: 'inclined-support', label: 'Inclined Roller', icon: ArrowUp },
              { id: 'enforced-disp', label: 'Enforced Displacement', icon: Move3d },
              { id: 'custom-support', label: 'Custom...', icon: Settings2, divider: true },
            ]
          },
        ]
      },
      {
        id: 'constraints',
        label: 'Constraints',
        tools: [
          { id: 'rigid-link', label: 'Rigid Link', icon: Lock },
          { id: 'master-slave', label: 'Master-Slave', icon: Target },
          { id: 'diaphragm', label: 'Diaphragm', icon: Grid3X3 },
        ]
      },
    ]
  },
  {
    id: 'loading',
    label: 'Loading',
    icon: Weight,
    groups: [
      {
        id: 'load-cases',
        label: 'Load Cases',
        tools: [
          { id: 'manage-cases', label: 'Manage\nCases', icon: Table2, variant: 'primary' },
          { id: 'combinations', label: 'Load\nCombinations', icon: Layers },
          { id: 'envelopes', label: 'Envelopes', icon: TrendingUp },
        ]
      },
      {
        id: 'nodal-loads',
        label: 'Nodal Loads',
        tools: [
          { id: 'point-load', label: 'Point\nLoad', icon: ArrowDown, shortcut: 'F' },
          { id: 'moment', label: 'Moment', icon: RotateCcw },
          { id: 'displacement', label: 'Enforced\nDisp.', icon: Move3d },
        ]
      },
      {
        id: 'member-loads',
        label: 'Member Loads',
        tools: [
          { id: 'uniform-load', label: 'Uniform', icon: ArrowDown },
          { id: 'point-member', label: 'Point', icon: ArrowDown },
          { id: 'trapezoidal', label: 'Trapezoidal', icon: TrendingUp },
          { id: 'temperature', label: 'Temperature', icon: Activity },
        ]
      },
      {
        id: 'area-loads',
        label: 'Area Loads',
        tools: [
          { id: 'floor-load', label: 'Floor\nLoad', icon: Grid3X3 },
          { id: 'pressure', label: 'Pressure', icon: Layers },
        ]
      },
      {
        id: 'auto-loads',
        label: 'Auto Generate',
        tools: [
          { id: 'dead-load', label: 'Dead\nLoad', icon: Weight, variant: 'success' },
          { id: 'wind-load', label: 'Wind\nLoad', icon: Wind },
          { id: 'seismic', label: 'Seismic', icon: Activity },
          { 
            id: 'code-loads', label: 'Code\nLoads', icon: FileText,
            dropdown: [
              { id: 'is875', label: 'IS 875 (India)', icon: FileText },
              { id: 'asce7', label: 'ASCE 7 (US)', icon: FileText },
              { id: 'eurocode', label: 'Eurocode', icon: FileText },
              { id: 'bs6399', label: 'BS 6399 (UK)', icon: FileText },
            ]
          },
        ]
      },
    ]
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: Cpu,
    groups: [
      {
        id: 'run',
        label: 'Run',
        tools: [
          { id: 'run-analysis', label: 'Run\nAnalysis', icon: Play, variant: 'success', shortcut: 'F5' },
          { id: 'run-design', label: 'Run\nDesign', icon: Shield },
          { id: 'stop', label: 'Stop', icon: StopCircle, variant: 'danger' },
        ]
      },
      {
        id: 'analysis-type',
        label: 'Analysis Type',
        tools: [
          { id: 'linear-static', label: 'Linear\nStatic', icon: Activity },
          { id: 'pdelta', label: 'P-Delta', icon: TrendingUp },
          { id: 'modal', label: 'Modal', icon: Waves },
          { 
            id: 'advanced-analysis', label: 'Advanced', icon: ChevronDown,
            dropdown: [
              { id: 'response-spectrum', label: 'Response Spectrum', icon: LineChart },
              { id: 'time-history', label: 'Time History', icon: Activity },
              { id: 'buckling', label: 'Buckling', icon: AlertTriangle },
              { id: 'nonlinear', label: 'Nonlinear', icon: TrendingUp },
            ]
          },
        ]
      },
      {
        id: 'settings',
        label: 'Settings',
        tools: [
          { id: 'analysis-settings', label: 'Analysis\nSettings', icon: Settings2 },
          { id: 'solver-options', label: 'Solver\nOptions', icon: Cpu },
        ]
      },
    ]
  },
  {
    id: 'results',
    label: 'Results',
    icon: BarChart3,
    groups: [
      {
        id: 'reactions',
        label: 'Reactions',
        tools: [
          { id: 'show-reactions', label: 'Support\nReactions', icon: ArrowDown, variant: 'primary' },
          { id: 'reaction-table', label: 'Reaction\nTable', icon: Table2 },
        ]
      },
      {
        id: 'diagrams',
        label: 'Diagrams',
        tools: [
          { id: 'bmd', label: 'Bending\nMoment', icon: LineChart },
          { id: 'sfd', label: 'Shear\nForce', icon: BarChart3 },
          { id: 'afd', label: 'Axial\nForce', icon: TrendingUp },
          { id: 'deflection', label: 'Deflected\nShape', icon: Activity },
        ]
      },
      {
        id: 'stresses',
        label: 'Stresses',
        tools: [
          { id: 'stress-contour', label: 'Stress\nContour', icon: Layers },
          { id: 'utilization', label: 'Utilization\nRatio', icon: Gauge },
        ]
      },
      {
        id: 'reports',
        label: 'Reports',
        tools: [
          { id: 'generate-report', label: 'Generate\nReport', icon: FileText, variant: 'primary' },
          { id: 'quick-summary', label: 'Quick\nSummary', icon: BarChart3 },
        ]
      },
    ]
  },
  {
    id: 'design',
    label: 'Design',
    icon: Shield,
    groups: [
      {
        id: 'steel-design',
        label: 'Steel Design',
        tools: [
          { id: 'steel-check', label: 'Code\nCheck', icon: CheckCircle2, variant: 'primary' },
          { id: 'steel-optimize', label: 'Auto\nOptimize', icon: Zap },
          { 
            id: 'steel-code', label: 'Design\nCode', icon: FileText,
            dropdown: [
              { id: 'is800', label: 'IS 800 (India)', icon: FileText },
              { id: 'aisc360', label: 'AISC 360 (US)', icon: FileText },
              { id: 'ec3', label: 'Eurocode 3', icon: FileText },
              { id: 'bs5950', label: 'BS 5950 (UK)', icon: FileText },
            ]
          },
        ]
      },
      {
        id: 'concrete-design',
        label: 'Concrete Design',
        tools: [
          { id: 'rc-design', label: 'RC\nDesign', icon: Grid3X3 },
          { id: 'rebar', label: 'Rebar\nDetails', icon: Spline },
        ]
      },
      {
        id: 'connection',
        label: 'Connections',
        tools: [
          { id: 'connection-design', label: 'Connection\nDesign', icon: Wrench },
          { id: 'base-plate', label: 'Base\nPlate', icon: Grid3X3 },
        ]
      },
    ]
  },
  {
    id: 'view',
    label: 'View',
    icon: Eye,
    groups: [
      {
        id: 'camera',
        label: 'Camera',
        tools: [
          { id: 'view-3d', label: '3D View', icon: Box },
          { id: 'view-front', label: 'Front', icon: Square },
          { id: 'view-top', label: 'Top', icon: Grid3X3 },
          { id: 'view-right', label: 'Right', icon: Square },
          { id: 'fit-all', label: 'Fit All', icon: Maximize2, shortcut: 'F' },
        ]
      },
      {
        id: 'display',
        label: 'Display',
        tools: [
          { id: 'show-nodes', label: 'Nodes', icon: Circle },
          { id: 'show-members', label: 'Members', icon: Spline },
          { id: 'show-loads', label: 'Loads', icon: ArrowDown },
          { id: 'show-supports', label: 'Supports', icon: Anchor },
        ]
      },
      {
        id: 'render',
        label: 'Render',
        tools: [
          { id: 'wireframe', label: 'Wireframe', icon: Box },
          { id: 'solid', label: 'Solid', icon: Box },
          { id: 'rendered', label: 'Rendered', icon: Camera },
        ]
      },
    ]
  },
];

// ============================================
// QUICK ACCESS TOOLBAR (QAT)
// ============================================

const QuickAccessToolbar: FC<{
  onAction: (action: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
}> = ({ onAction, canUndo, canRedo, hasUnsavedChanges }) => {
  const qatTools = [
    { id: 'save', icon: Save, tooltip: 'Save (Ctrl+S)', highlight: hasUnsavedChanges },
    { id: 'undo', icon: Undo, tooltip: 'Undo (Ctrl+Z)', disabled: !canUndo },
    { id: 'redo', icon: Redo, tooltip: 'Redo (Ctrl+Y)', disabled: !canRedo },
  ];

  return (
    <div className="flex items-center gap-0.5 px-2">
      {qatTools.map((tool) => (
        <button type="button"
          key={tool.id}
          onClick={() => onAction(tool.id)}
          disabled={tool.disabled}
          className={`
            p-1.5 rounded transition-all
            ${tool.disabled 
              ? 'opacity-30 cursor-not-allowed text-[#869ab8]' 
              : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-[#869ab8] hover:text-slate-900 dark:hover:text-white'}
            ${tool.highlight ? 'text-blue-400 animate-pulse' : ''}
          `}
          title={tool.tooltip}
        >
          <tool.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
};

// ============================================
// TOOL BUTTON COMPONENT
// ============================================

interface ToolButtonProps {
  tool: RibbonToolWithDropdown;
  isActive: boolean;
  size?: 'small' | 'large';
  onClick: () => void;
  onDropdownItemClick?: (itemId: string) => void;
}

const ToolButton: FC<ToolButtonProps> = ({ 
  tool, 
  isActive, 
  size = 'large', 
  onClick, 
  onDropdownItemClick 
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const Icon = tool.icon;
  const hasDropdown = tool.dropdown && tool.dropdown.length > 0;
  const isLarge = size === 'large';

  // Variant colors
  const variantStyles = {
    default: 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
    primary: 'text-blue-400 hover:text-blue-300',
    success: 'text-emerald-400 hover:text-emerald-300',
    warning: 'text-amber-400 hover:text-amber-300',
    danger: 'text-red-400 hover:text-red-300',
  };

  const activeStyles = {
    default: 'bg-blue-600/30 border-blue-500/50 text-blue-300',
    primary: 'bg-blue-600/40 border-blue-400/60 text-blue-200',
    success: 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300',
    warning: 'bg-amber-600/30 border-amber-500/50 text-amber-300',
    danger: 'bg-red-600/30 border-red-500/50 text-red-300',
  };

  const variant = tool.variant || 'default';

  return (
    <div className="relative" ref={dropdownRef}>
      <div className={`
        flex ${hasDropdown && tool.splitButton ? '' : 'flex-col'}
        ${isLarge ? '' : 'flex-row'}
      `}>
        {/* Main Button */}
        <button type="button"
          onClick={() => {
            if (!hasDropdown || tool.splitButton) {
              onClick();
            } else {
              setDropdownOpen(!dropdownOpen);
            }
          }}
          disabled={tool.disabled}
          className={`
            flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-t
            border border-transparent transition-all relative group
            ${isLarge ? 'min-w-[56px] h-[52px]' : 'min-w-[44px] h-8 flex-row gap-1.5 px-2'}
            ${isActive 
              ? activeStyles[variant]
              : `hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:border-slate-600/50 ${variantStyles[variant]}`}
            ${tool.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          `}
          title={tool.tooltip || `${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
        >
          <Icon className={isLarge ? 'w-5 h-5' : 'w-4 h-4'} />
          {isLarge && (
            <span className="text-[10px] leading-tight text-center whitespace-pre-line max-w-[52px]">
              {tool.label}
            </span>
          )}
          {tool.badge && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] px-1 rounded-full">
              {tool.badge}
            </span>
          )}
        </button>

        {/* Dropdown Arrow (for non-split buttons with dropdown) */}
        {hasDropdown && !tool.splitButton && (
          <button type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`
              flex items-center justify-center w-full h-3 rounded-b
              ${isActive 
                ? 'bg-blue-600/20 text-blue-400' 
                : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300'}
              transition-colors
            `}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}

        {/* Split Button Arrow */}
        {hasDropdown && tool.splitButton && (
          <button type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`
              flex items-center justify-center w-5 border-l border-[#1a2333]
              ${isActive ? 'bg-blue-600/20' : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}
              transition-colors
            `}
          >
            <ChevronDown className="w-3 h-3 text-[#869ab8]" />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {dropdownOpen && hasDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 min-w-[180px] bg-[#131b2e] border border-[#1a2333] rounded-lg shadow-xl z-50 py-1 overflow-hidden"
          >
            {tool.dropdown?.map((item, idx) => (
              <div key={item.id}>
                {item.divider && idx > 0 && <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />}
                <button type="button"
                  onClick={() => {
                    onDropdownItemClick?.(item.id);
                    setDropdownOpen(false);
                  }}
                  disabled={item.disabled}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-sm
                    ${item.disabled 
                      ? 'opacity-40 cursor-not-allowed text-[#869ab8]' 
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}
                    transition-colors
                  `}
                >
                  <item.icon className="w-4 h-4 text-[#869ab8]" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[10px] text-[#869ab8]">{item.shortcut}</span>
                  )}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// TOOL GROUP COMPONENT
// ============================================

interface ToolGroupComponentProps {
  group: RibbonGroup;
  activeTool: string;
  onToolSelect: (toolId: string) => void;
}

const ToolGroupComponent: FC<ToolGroupComponentProps> = ({ group, activeTool, onToolSelect }) => {
  return (
    <div className="flex flex-col h-full border-r border-slate-200/50 dark:border-slate-700/50 px-2 pb-1 pt-1 last:border-r-0">
      {/* Tools Row */}
      <div className="flex-1 flex items-start gap-0.5">
        {group.tools.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            size="large"
            onClick={() => onToolSelect(tool.id)}
            onDropdownItemClick={(itemId) => onToolSelect(itemId)}
          />
        ))}
      </div>
      
      {/* Group Label */}
      <div className="text-[9px] text-[#869ab8] text-center uppercase tracking-wider mt-auto pt-1 select-none">
        {group.label}
      </div>
    </div>
  );
};

// ============================================
// MAIN RIBBON COMPONENT
// ============================================

export const ProfessionalRibbon: FC<ProfessionalRibbonProps> = ({
  activeTab: controlledActiveTab,
  activeTool: controlledActiveTool,
  onTabChange,
  onToolSelect,
  onAction,
  projectName = 'Untitled Project',
  isAnalyzing = false,
  hasUnsavedChanges = false,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState('geometry');
  const [internalActiveTool, setInternalActiveTool] = useState('select');
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const activeTab = controlledActiveTab ?? internalActiveTab;
  const activeTool = controlledActiveTool ?? internalActiveTool;
  const collapsed = controlledCollapsed ?? internalCollapsed;

  const handleTabChange = useCallback((tabId: string) => {
    setInternalActiveTab(tabId);
    onTabChange?.(tabId);
  }, [onTabChange]);

  const handleToolSelect = useCallback((toolId: string) => {
    setInternalActiveTool(toolId);
    onToolSelect?.(toolId);
  }, [onToolSelect]);

  const handleCollapsedChange = useCallback((value: boolean) => {
    setInternalCollapsed(value);
    onCollapsedChange?.(value);
  }, [onCollapsedChange]);

  const handleAction = useCallback((action: string) => {
    onAction?.(action);
  }, [onAction]);

  const currentTab = RIBBON_TABS.find((t) => t.id === activeTab);

  return (
    <div className="w-full bg-[#0b1326] border-b border-[#1a2333] flex flex-col select-none">
      {/* Title Bar */}
      <div className="h-9 flex items-center justify-between px-3 bg-[#0b1326] border-b border-[#1a2333]">
        {/* Left: Logo + QAT */}
        <div className="flex items-center gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 pr-3 border-r border-[#1a2333]">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-white">StructPro</span>
            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded">
              ULTIMATE
            </span>
          </div>

          {/* Quick Access Toolbar */}
          <QuickAccessToolbar
            onAction={handleAction}
            canUndo={true}
            canRedo={false}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>

        {/* Center: Project Name */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#869ab8]">{projectName}</span>
          {hasUnsavedChanges && <span className="text-amber-400 text-xs">•</span>}
        </div>

        {/* Right: Search + Help */}
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 text-[#869ab8] text-xs transition-colors"
          >
            <Search className="w-3 h-3" />
            <span>Search</span>
            <span className="text-slate-500">Ctrl+K</span>
          </button>
          <button type="button" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[#869ab8] transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Strip */}
      <div className="h-8 flex items-center gap-0.5 px-2 bg-[#0b1326] border-b border-[#1a2333]">
        {RIBBON_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          
          return (
            <button type="button"
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm font-medium tracking-wide
                transition-all relative
                ${isActive 
                  ? 'bg-[#131b2e] text-[#dae2fd] border-t-2 border-blue-500' 
                  : 'text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}
                ${tab.contextual ? 'text-emerald-400' : ''}
              `}
            >
              {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
              {tab.label}
            </button>
          );
        })}

        {/* Collapse Button */}
        <div className="ml-auto flex items-center">
          <button type="button"
            onClick={() => handleCollapsedChange(!collapsed)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={collapsed ? 'Expand Ribbon' : 'Collapse Ribbon'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ribbon Content */}
      <AnimatePresence>
        {!collapsed && currentTab && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="h-[72px] flex items-stretch px-2 py-1 bg-slate-850">
              {currentTab.groups.map((group) => (
                <ToolGroupComponent
                  key={group.id}
                  group={group}
                  activeTool={activeTool}
                  onToolSelect={handleToolSelect}
                />
              ))}

              {/* Analysis Status (shown when analyzing) */}
              {isAnalyzing && (
                <div className="ml-auto flex items-center gap-3 px-4 border-l border-[#1a2333]">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-sm text-blue-400">Analyzing...</span>
                  </div>
                  <button type="button"
                    onClick={() => handleAction('stop-analysis')}
                    className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs transition-colors"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfessionalRibbon;
