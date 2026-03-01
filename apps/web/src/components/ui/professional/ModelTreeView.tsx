/**
 * ModelTreeView.tsx - Hierarchical Model Structure Tree (STAAD.Pro/SkyCiv Style)
 * 
 * Professional tree view with:
 * - Expandable/collapsible hierarchy
 * - Multi-select with Ctrl/Shift
 * - Right-click context menus
 * - Drag-drop reordering
 * - Search/filter functionality
 * - Icons for different element types
 * - Visibility toggles
 * - Selection highlighting synced with 3D view
 */

import React from 'react';
import { FC, useState, useCallback, useMemo, memo, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  ChevronRight, ChevronDown, Circle, Box, Square, ArrowDown, Anchor,
  Layers, FileText, FolderOpen, Folder, Eye, EyeOff, Lock, Unlock,
  MoreHorizontal, Search, Filter, Plus, Trash2, Copy, Clipboard,
  Edit3, CheckCircle2, AlertTriangle, Settings, Grid3X3, Zap,
  Weight, Wind, Building2, Activity, Target, Move, RefreshCw
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type NodeType = 
  | 'root' 
  | 'folder' 
  | 'geometry' 
  | 'node' 
  | 'member' 
  | 'plate' 
  | 'support'
  | 'load' 
  | 'load-case' 
  | 'material' 
  | 'section'
  | 'group'
  | 'analysis'
  | 'result';

export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  icon?: React.ElementType;
  children?: TreeNode[];
  parent?: string;
  data?: any;
  expanded?: boolean;
  visible?: boolean;
  locked?: boolean;
  selected?: boolean;
  status?: 'normal' | 'warning' | 'error' | 'success';
  badge?: string | number;
  contextMenu?: string[];
}

interface TreeNodeConfig {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  allowChildren: boolean;
  defaultExpanded: boolean;
}

interface ModelTreeViewProps {
  data: TreeNode[];
  selectedIds?: string[];
  expandedIds?: string[];
  onSelect?: (ids: string[], node: TreeNode) => void;
  onExpand?: (id: string, expanded: boolean) => void;
  onToggleVisibility?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onDoubleClick?: (node: TreeNode) => void;
  onContextMenu?: (node: TreeNode, event: React.MouseEvent) => void;
  onDrop?: (sourceId: string, targetId: string, position: 'before' | 'inside' | 'after') => void;
  searchable?: boolean;
  showToolbar?: boolean;
  showStatusIcons?: boolean;
  compact?: boolean;
  multiSelect?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const NODE_CONFIGS: Record<NodeType, TreeNodeConfig> = {
  root: { icon: Building2, color: 'text-blue-400', bgColor: 'bg-blue-500/20', allowChildren: true, defaultExpanded: true },
  folder: { icon: Folder, color: 'text-amber-400', bgColor: 'bg-amber-500/20', allowChildren: true, defaultExpanded: false },
  geometry: { icon: Box, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', allowChildren: true, defaultExpanded: true },
  node: { icon: Circle, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', allowChildren: false, defaultExpanded: false },
  member: { icon: Layers, color: 'text-blue-400', bgColor: 'bg-blue-500/20', allowChildren: false, defaultExpanded: false },
  plate: { icon: Square, color: 'text-purple-400', bgColor: 'bg-purple-500/20', allowChildren: false, defaultExpanded: false },
  support: { icon: Anchor, color: 'text-orange-400', bgColor: 'bg-orange-500/20', allowChildren: false, defaultExpanded: false },
  load: { icon: ArrowDown, color: 'text-red-400', bgColor: 'bg-red-500/20', allowChildren: false, defaultExpanded: false },
  'load-case': { icon: FileText, color: 'text-pink-400', bgColor: 'bg-pink-500/20', allowChildren: true, defaultExpanded: false },
  material: { icon: Grid3X3, color: 'text-teal-400', bgColor: 'bg-teal-500/20', allowChildren: false, defaultExpanded: false },
  section: { icon: Target, color: 'text-indigo-400', bgColor: 'bg-indigo-500/20', allowChildren: false, defaultExpanded: false },
  group: { icon: Layers, color: 'text-violet-400', bgColor: 'bg-violet-500/20', allowChildren: true, defaultExpanded: false },
  analysis: { icon: Activity, color: 'text-rose-400', bgColor: 'bg-rose-500/20', allowChildren: true, defaultExpanded: false },
  result: { icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-500/20', allowChildren: false, defaultExpanded: false },
};

// ============================================
// SEARCH BAR COMPONENT
// ============================================

const TreeSearchBar: FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = memo(({ value, onChange, placeholder = 'Search tree...' }) => (
  <div className="relative px-2 py-1.5">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        ×
      </button>
    )}
  </div>
));

TreeSearchBar.displayName = 'TreeSearchBar';

// ============================================
// TREE TOOLBAR COMPONENT
// ============================================

const TreeToolbar: FC<{
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onFilter?: () => void;
  onRefresh?: () => void;
}> = memo(({ onExpandAll, onCollapseAll, onFilter, onRefresh }) => (
  <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-200 dark:border-slate-800">
    <button
      onClick={onExpandAll}
      className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
      title="Expand All"
    >
      <ChevronDown className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={onCollapseAll}
      className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
      title="Collapse All"
    >
      <ChevronRight className="w-3.5 h-3.5" />
    </button>
    {onFilter && (
      <button
        onClick={onFilter}
        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
        title="Filter"
      >
        <Filter className="w-3.5 h-3.5" />
      </button>
    )}
    {onRefresh && (
      <button
        onClick={onRefresh}
        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded ml-auto"
        title="Refresh"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
));

TreeToolbar.displayName = 'TreeToolbar';

// ============================================
// TREE NODE COMPONENT
// ============================================

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelect: (event: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onToggleVisibility?: () => void;
  onToggleLock?: () => void;
  showStatusIcons?: boolean;
  compact?: boolean;
}

const TreeNodeItem: FC<TreeNodeItemProps> = memo(({
  node,
  depth,
  isSelected,
  isExpanded,
  onToggleExpand,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onToggleVisibility,
  onToggleLock,
  showStatusIcons = true,
  compact = false
}) => {
  const config = NODE_CONFIGS[node.type] || NODE_CONFIGS.folder;
  const Icon = node.icon || config.icon;
  const hasChildren = node.children && node.children.length > 0;
  
  const paddingLeft = 8 + (depth * 16);
  const height = compact ? 24 : 28;

  const getStatusIcon = () => {
    if (!showStatusIcons || !node.status || node.status === 'normal') return null;
    
    switch (node.status) {
      case 'success':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3 text-amber-400" />;
      case 'error':
        return <AlertTriangle className="w-3 h-3 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex items-center gap-1 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-500/30 text-blue-100'
          : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
      }`}
      style={{ paddingLeft, height }}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (hasChildren) {
          onToggleExpand();
        } else {
          onDoubleClick?.();
        }
      }}
      onContextMenu={onContextMenu}
    >
      {/* Expand/Collapse Arrow */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        className={`w-4 h-4 flex items-center justify-center flex-shrink-0 ${
          hasChildren ? 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300' : 'invisible'
        }`}
      >
        {hasChildren && (
          isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
        )}
      </button>

      {/* Icon */}
      <div className={`w-5 h-5 flex items-center justify-center rounded flex-shrink-0 ${config.bgColor}`}>
        <Icon className={`w-3 h-3 ${config.color}`} />
      </div>

      {/* Name */}
      <span className={`flex-1 truncate text-xs ${compact ? '' : 'font-medium'}`}>
        {node.name}
      </span>

      {/* Status Icon */}
      {getStatusIcon()}

      {/* Badge */}
      {node.badge !== undefined && (
        <span className="px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
          {node.badge}
        </span>
      )}

      {/* Visibility Toggle */}
      {onToggleVisibility && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
            node.visible === false ? 'text-slate-500' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {node.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      )}

      {/* Lock Toggle */}
      {onToggleLock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
          className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
            node.locked ? 'text-amber-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {node.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
});

TreeNodeItem.displayName = 'TreeNodeItem';

// ============================================
// RECURSIVE TREE RENDERER
// ============================================

interface TreeBranchProps {
  nodes: TreeNode[];
  depth: number;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onSelect: (id: string, node: TreeNode, event: React.MouseEvent) => void;
  onToggleExpand: (id: string) => void;
  onDoubleClick?: (node: TreeNode) => void;
  onContextMenu?: (node: TreeNode, event: React.MouseEvent) => void;
  onToggleVisibility?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  showStatusIcons?: boolean;
  compact?: boolean;
  filterText?: string;
}

const TreeBranch: FC<TreeBranchProps> = ({
  nodes,
  depth,
  selectedIds,
  expandedIds,
  onSelect,
  onToggleExpand,
  onDoubleClick,
  onContextMenu,
  onToggleVisibility,
  onToggleLock,
  showStatusIcons,
  compact,
  filterText
}) => {
  // Filter nodes if filterText is provided
  const filteredNodes = useMemo(() => {
    if (!filterText) return nodes;
    
    const filter = filterText.toLowerCase();
    return nodes.filter(node => {
      const matchesName = node.name.toLowerCase().includes(filter);
      const hasMatchingChildren = node.children?.some(child => 
        child.name.toLowerCase().includes(filter)
      );
      return matchesName || hasMatchingChildren;
    });
  }, [nodes, filterText]);

  return (
    <>
      {filteredNodes.map(node => {
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedIds.has(node.id);

        return (
          <div key={node.id}>
            <TreeNodeItem
              node={node}
              depth={depth}
              isSelected={isSelected}
              isExpanded={isExpanded}
              onToggleExpand={() => onToggleExpand(node.id)}
              onSelect={(e) => onSelect(node.id, node, e)}
              onDoubleClick={() => onDoubleClick?.(node)}
              onContextMenu={(e) => onContextMenu?.(node, e)}
              onToggleVisibility={onToggleVisibility ? () => onToggleVisibility(node.id) : undefined}
              onToggleLock={onToggleLock ? () => onToggleLock(node.id) : undefined}
              showStatusIcons={showStatusIcons}
              compact={compact}
            />
            
            <AnimatePresence>
              {isExpanded && node.children && node.children.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <TreeBranch
                    nodes={node.children}
                    depth={depth + 1}
                    selectedIds={selectedIds}
                    expandedIds={expandedIds}
                    onSelect={onSelect}
                    onToggleExpand={onToggleExpand}
                    onDoubleClick={onDoubleClick}
                    onContextMenu={onContextMenu}
                    onToggleVisibility={onToggleVisibility}
                    onToggleLock={onToggleLock}
                    showStatusIcons={showStatusIcons}
                    compact={compact}
                    filterText={filterText}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
};

// ============================================
// MAIN MODEL TREE VIEW COMPONENT
// ============================================

export const ModelTreeView: FC<ModelTreeViewProps> = ({
  data,
  selectedIds: externalSelectedIds,
  expandedIds: externalExpandedIds,
  onSelect,
  onExpand,
  onToggleVisibility,
  onToggleLock,
  onDoubleClick,
  onContextMenu,
  searchable = true,
  showToolbar = true,
  showStatusIcons = true,
  compact = false,
  multiSelect = true
}) => {
  const [searchText, setSearchText] = useState('');
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(() => {
    // Initialize with default expanded nodes
    const expanded = new Set<string>();
    const processNode = (node: TreeNode) => {
      const config = NODE_CONFIGS[node.type];
      if (config?.defaultExpanded || node.expanded) {
        expanded.add(node.id);
      }
      node.children?.forEach(processNode);
    };
    data.forEach(processNode);
    return expanded;
  });

  const selectedIds = externalSelectedIds 
    ? new Set(externalSelectedIds) 
    : internalSelectedIds;

  const expandedIds = externalExpandedIds 
    ? new Set(externalExpandedIds) 
    : internalExpandedIds;

  const handleSelect = useCallback((id: string, node: TreeNode, event: React.MouseEvent) => {
    let newSelection: Set<string>;

    if (multiSelect && (event.ctrlKey || event.metaKey)) {
      // Toggle selection
      newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
    } else if (multiSelect && event.shiftKey && selectedIds.size > 0) {
      // Range selection (simplified - just add to selection)
      newSelection = new Set(selectedIds);
      newSelection.add(id);
    } else {
      // Single selection
      newSelection = new Set([id]);
    }

    if (!externalSelectedIds) {
      setInternalSelectedIds(newSelection);
    }
    onSelect?.(Array.from(newSelection), node);
  }, [selectedIds, multiSelect, externalSelectedIds, onSelect]);

  const handleToggleExpand = useCallback((id: string) => {
    const newExpanded = new Set(expandedIds);
    const isExpanded = newExpanded.has(id);
    
    if (isExpanded) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }

    if (!externalExpandedIds) {
      setInternalExpandedIds(newExpanded);
    }
    onExpand?.(id, !isExpanded);
  }, [expandedIds, externalExpandedIds, onExpand]);

  const handleExpandAll = useCallback(() => {
    const allIds = new Set<string>();
    const processNode = (node: TreeNode) => {
      if (node.children && node.children.length > 0) {
        allIds.add(node.id);
        node.children.forEach(processNode);
      }
    };
    data.forEach(processNode);
    
    if (!externalExpandedIds) {
      setInternalExpandedIds(allIds);
    }
  }, [data, externalExpandedIds]);

  const handleCollapseAll = useCallback(() => {
    if (!externalExpandedIds) {
      setInternalExpandedIds(new Set());
    }
  }, [externalExpandedIds]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Search Bar */}
      {searchable && (
        <TreeSearchBar
          value={searchText}
          onChange={setSearchText}
        />
      )}

      {/* Toolbar */}
      {showToolbar && (
        <TreeToolbar
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
        />
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-auto py-1">
        <TreeBranch
          nodes={data}
          depth={0}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          onSelect={handleSelect}
          onToggleExpand={handleToggleExpand}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onToggleVisibility={onToggleVisibility}
          onToggleLock={onToggleLock}
          showStatusIcons={showStatusIcons}
          compact={compact}
          filterText={searchText}
        />
      </div>

      {/* Selection Info */}
      {selectedIds.size > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};

// ============================================
// PRESET STRUCTURAL MODEL TREE
// ============================================

export const createStructuralModelTree = (model: {
  nodes?: Array<{ id: string; x: number; y: number; z: number }>;
  members?: Array<{ id: string; startNode: string; endNode: string; section?: string }>;
  plates?: Array<{ id: string }>;
  supports?: Array<{ nodeId: string; type: string }>;
  loadCases?: Array<{ id: string; name: string; loads: Array<{ id: string; type: string }> }>;
  materials?: Array<{ id: string; name: string }>;
  sections?: Array<{ id: string; name: string }>;
}): TreeNode[] => {
  return [
    {
      id: 'model-root',
      name: 'Structural Model',
      type: 'root',
      expanded: true,
      children: [
        {
          id: 'geometry-folder',
          name: 'Geometry',
          type: 'geometry',
          badge: (model.nodes?.length || 0) + (model.members?.length || 0),
          children: [
            {
              id: 'nodes-folder',
              name: 'Nodes',
              type: 'folder',
              icon: Circle,
              badge: model.nodes?.length || 0,
              children: model.nodes?.map(n => ({
                id: `node-${n.id}`,
                name: `N${n.id} (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)})`,
                type: 'node' as NodeType,
                data: n
              })) || []
            },
            {
              id: 'members-folder',
              name: 'Members',
              type: 'folder',
              icon: Layers,
              badge: model.members?.length || 0,
              children: model.members?.map(m => ({
                id: `member-${m.id}`,
                name: `M${m.id} (${m.startNode} → ${m.endNode})`,
                type: 'member' as NodeType,
                data: m
              })) || []
            },
            {
              id: 'plates-folder',
              name: 'Plates',
              type: 'folder',
              icon: Square,
              badge: model.plates?.length || 0,
              children: model.plates?.map(p => ({
                id: `plate-${p.id}`,
                name: `P${p.id}`,
                type: 'plate' as NodeType,
                data: p
              })) || []
            }
          ]
        },
        {
          id: 'supports-folder',
          name: 'Supports',
          type: 'folder',
          icon: Anchor,
          badge: model.supports?.length || 0,
          children: model.supports?.map(s => ({
            id: `support-${s.nodeId}`,
            name: `Support @ N${s.nodeId} (${s.type})`,
            type: 'support' as NodeType,
            data: s
          })) || []
        },
        {
          id: 'loads-folder',
          name: 'Loading',
          type: 'folder',
          icon: ArrowDown,
          badge: model.loadCases?.length || 0,
          children: model.loadCases?.map(lc => ({
            id: `loadcase-${lc.id}`,
            name: lc.name,
            type: 'load-case' as NodeType,
            badge: lc.loads.length,
            children: lc.loads.map(l => ({
              id: `load-${l.id}`,
              name: `Load ${l.id} (${l.type})`,
              type: 'load' as NodeType,
              data: l
            }))
          })) || []
        },
        {
          id: 'properties-folder',
          name: 'Properties',
          type: 'folder',
          icon: Settings,
          children: [
            {
              id: 'materials-folder',
              name: 'Materials',
              type: 'folder',
              icon: Grid3X3,
              badge: model.materials?.length || 0,
              children: model.materials?.map(m => ({
                id: `material-${m.id}`,
                name: m.name,
                type: 'material' as NodeType,
                data: m
              })) || []
            },
            {
              id: 'sections-folder',
              name: 'Sections',
              type: 'folder',
              icon: Target,
              badge: model.sections?.length || 0,
              children: model.sections?.map(s => ({
                id: `section-${s.id}`,
                name: s.name,
                type: 'section' as NodeType,
                data: s
              })) || []
            }
          ]
        }
      ]
    }
  ];
};

export default ModelTreeView;
