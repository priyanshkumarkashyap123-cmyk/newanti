/**
 * History Panel Component
 * 
 * Industry-standard visual history with:
 * - Timeline visualization
 * - Branch management (like Git)
 * - Snapshot previews
 * - Keyboard navigation
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  usePersistentHistory,
  useUndoRedoKeyboard,
} from '@/lib/persistent-history';
import { useModelStore } from '@/store/model';
import { HistoryBranch, HistorySnapshot } from '@/lib/indexeddb-history';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
import { Button } from './button';
import { Input } from './input';

// ============================================================================
// TYPES
// ============================================================================

interface HistoryPanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface BranchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBranch: (name: string) => void;
}

// ============================================================================
// ICONS
// ============================================================================

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.5 3L1 6.5 4.5 10V7h4c2.2 0 4 1.8 4 4s-1.8 4-4 4H5v1h3.5c2.76 0 5-2.24 5-5s-2.24-5-5-5h-4V3z"/>
  </svg>
);

const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.5 3L15 6.5 11.5 10V7h-4c-2.2 0-4 1.8-4 4s1.8 4 4 4H11v1H7.5c-2.76 0-5-2.24-5-5s2.24-5 5-5h4V3z"/>
  </svg>
);

const BranchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm6 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm1-2a1 1 0 1 0-2 0 1 1 0 0 0 2 0zM5 8v3a1 1 0 0 0 1 1h3v1H6a2 2 0 0 1-2-2V8H3V7h3v1H5zm6-1V5h1v2h2v1h-2v1h-1V8h-1V7h1z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
    <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
  </svg>
);

// ============================================================================
// BRANCH DIALOG
// ============================================================================

const BranchDialog: React.FC<BranchDialogProps> = ({
  isOpen,
  onClose,
  onCreateBranch,
}) => {
  const [branchName, setBranchName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (branchName.trim()) {
      onCreateBranch(branchName.trim());
      setBranchName('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Branch</DialogTitle>
          <DialogDescription>Create a new branch from the current state.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            type="text"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="Branch name..."
            autoFocus
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!branchName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// HISTORY ITEM
// ============================================================================

interface HistoryItemProps {
  snapshot: HistorySnapshot;
  isCurrent: boolean;
  onClick: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  snapshot,
  isCurrent,
  onClick,
}) => {
  const formattedTime = useMemo(() => {
    const date = new Date(snapshot.timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  }, [snapshot.timestamp]);

  return (
    <button type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isCurrent
          ? 'bg-blue-600/20 border border-blue-500/50'
          : 'bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Timeline dot */}
        <div className="mt-1.5 relative">
          <div
            className={`w-3 h-3 rounded-full ${
              isCurrent ? 'bg-blue-500' : 'bg-slate-500'
            }`}
          />
          {isCurrent && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-blue-500 animate-ping opacity-50" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-900 dark:text-white truncate">{snapshot.description}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formattedTime}</p>
        </div>
        
        {isCurrent && (
          <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
            Current
          </span>
        )}
      </div>
    </button>
  );
};

// ============================================================================
// BRANCH SELECTOR
// ============================================================================

interface BranchSelectorProps {
  branches: HistoryBranch[];
  currentBranchId: string;
  onSwitchBranch: (branchId: string) => void;
  onDeleteBranch: (branchId: string) => void;
  onCreateBranch: () => void;
}

const BranchSelector: React.FC<BranchSelectorProps> = ({
  branches,
  currentBranchId,
  onSwitchBranch,
  onDeleteBranch,
  onCreateBranch,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentBranch = branches.find((b) => b.id === currentBranchId);

  return (
    <div className="relative">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      >
        <BranchIcon />
        <span className="text-sm text-slate-900 dark:text-white">{currentBranch?.name || 'Main'}</span>
        <svg
          className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4 6l4 4 4-4H4z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20">
            <div className="p-2">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`flex items-center justify-between px-3 py-2 rounded ${
                    branch.id === currentBranchId
                      ? 'bg-blue-600/20'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <button type="button"
                    onClick={() => {
                      onSwitchBranch(branch.id);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left text-sm text-slate-900 dark:text-white"
                  >
                    {branch.name}
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                      ({branch.snapshotIds.length})
                    </span>
                  </button>
                  {branch.id !== 'main' && (
                    <button type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBranch(branch.id);
                      }}
                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete branch"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 p-2">
              <button type="button"
                onClick={() => {
                  onCreateBranch();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <span className="text-lg">+</span>
                Create new branch
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// MAIN HISTORY PANEL
// ============================================================================

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  projectId,
  isOpen,
  onClose,
}) => {
  const [showBranchDialog, setShowBranchDialog] = useState(false);

  const {
    isReady,
    canUndo,
    canRedo,
    branches,
    currentBranchId,
    historyList,
    undo,
    redo,
    jumpToSnapshot,
    createBranch,
    switchBranch,
    deleteBranch,
    getStorageInfo,
    clearHistory,
  } = usePersistentHistory(useModelStore, { projectId });

  // Enable keyboard shortcuts
  useUndoRedoKeyboard(undo, redo, isOpen);

  const [storageInfo, setStorageInfo] = useState<{ snapshots: number; bytes: number } | null>(null);

  const loadStorageInfo = useCallback(async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
  }, [getStorageInfo]);

  // Find current snapshot index
  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const currentIndex = currentBranch?.currentIndex ?? -1;

  const handleCreateBranch = useCallback(
    async (name: string) => {
      await createBranch(name);
    },
    [createBranch]
  );

  const handleClearHistory = useCallback(async () => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clearHistory();
    }
  }, [clearHistory]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm h-[80vh] flex flex-col gap-0 p-0">
          {/* Header */}
          <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle>History</DialogTitle>
          </DialogHeader>

        {/* Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
          {/* Undo/Redo buttons */}
          <div className="flex gap-2">
            <Button
              onClick={undo}
              disabled={!canUndo}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2"
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon />
              <span>Undo</span>
            </Button>
            <Button
              onClick={redo}
              disabled={!canRedo}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2"
              title="Redo (Ctrl+Shift+Z)"
            >
              <RedoIcon />
              <span>Redo</span>
            </Button>
          </div>

          {/* Branch selector */}
          <div className="flex items-center justify-between">
            <BranchSelector
              branches={branches}
              currentBranchId={currentBranchId}
              onSwitchBranch={switchBranch}
              onDeleteBranch={deleteBranch}
              onCreateBranch={() => setShowBranchDialog(true)}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {historyList.length} snapshots
            </span>
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!isReady ? (
            <div className="flex items-center justify-center h-32 text-slate-500 dark:text-slate-400">
              <div className="animate-spin w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full" />
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p className="text-sm">No history yet</p>
              <p className="text-xs mt-1">Changes will appear here</p>
            </div>
          ) : (
            historyList.map((snapshot, index) => (
              <HistoryItem
                key={snapshot.id}
                snapshot={snapshot}
                isCurrent={index === currentIndex}
                onClick={() => jumpToSnapshot(snapshot.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <button type="button"
              onClick={loadStorageInfo}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {storageInfo
                ? `${storageInfo.snapshots} snapshots • ${formatBytes(storageInfo.bytes)}`
                : 'View storage info'}
            </button>
            <button type="button"
              onClick={handleClearHistory}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Clear history
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {/* Branch creation dialog */}
      <BranchDialog
        isOpen={showBranchDialog}
        onClose={() => setShowBranchDialog(false)}
        onCreateBranch={handleCreateBranch}
      />
    </>
  );
};

// ============================================================================
// HISTORY BUTTON (for toolbar)
// ============================================================================

interface HistoryButtonProps {
  projectId: string;
}

export const HistoryButton: React.FC<HistoryButtonProps> = ({ projectId }) => {
  const [isOpen, setIsOpen] = useState(false);

  const { canUndo, canRedo, undo, redo } = usePersistentHistory(useModelStore, {
    projectId,
  });

  // Enable keyboard shortcuts globally
  useUndoRedoKeyboard(undo, redo, true);

  return (
    <>
      <div className="flex items-center gap-1">
        <button type="button"
          onClick={undo}
          disabled={!canUndo}
          className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon />
        </button>
        <button type="button"
          onClick={redo}
          disabled={!canRedo}
          className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          title="Redo (Ctrl+Shift+Z)"
        >
          <RedoIcon />
        </button>
        <button type="button"
          onClick={() => setIsOpen(true)}
          className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="View history"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3.5a.5.5 0 00-1 0V9a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 8.71V3.5z" />
            <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      <HistoryPanel
        projectId={projectId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

export default HistoryPanel;
