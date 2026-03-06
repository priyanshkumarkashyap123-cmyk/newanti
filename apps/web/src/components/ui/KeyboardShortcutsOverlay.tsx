/**
 * KeyboardShortcutsOverlay.tsx — Professional Keyboard Shortcuts Reference
 * 
 * Triggered by pressing ? or F1 — displays all available shortcuts
 * in a professional overlay similar to STAAD Pro / VS Code.
 */

import { FC, memo, useState } from 'react';
import { Keyboard, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'S'], description: 'Save project' },
      { keys: ['Ctrl', 'K'], description: 'Command palette' },
      { keys: ['Delete'], description: 'Delete selection' },
      { keys: ['Esc'], description: 'Cancel / Deselect all' },
      { keys: ['?'], description: 'Show this help' },
      { keys: ['F1'], description: 'Show this help' },
    ],
  },
  {
    title: 'Tools',
    shortcuts: [
      { keys: ['V'], description: 'Select tool' },
      { keys: ['N'], description: 'Node (place point)' },
      { keys: ['M'], description: 'Member (draw beam)' },
      { keys: ['B'], description: 'Box select' },
      { keys: ['S'], description: 'Support tool' },
      { keys: ['L'], description: 'Load tool (nodal)' },
      { keys: ['U'], description: 'Member load (UDL)' },
      { keys: ['P'], description: 'Plate element' },
      { keys: ['G'], description: 'Toggle grid' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['F'], description: 'Fit view to model' },
      { keys: ['Scroll'], description: 'Zoom in/out' },
      { keys: ['Middle drag'], description: 'Pan view' },
      { keys: ['Right drag'], description: 'Orbit view' },
    ],
  },
  {
    title: 'Analysis',
    shortcuts: [
      { keys: ['F5'], description: 'Run analysis' },
    ],
  },
];

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsOverlay: FC<KeyboardShortcutsOverlayProps> = memo(({ isOpen, onClose }) => {
  const [filter, setFilter] = useState('');

  const filteredGroups = filter
    ? SHORTCUT_GROUPS.map(group => ({
        ...group,
        shortcuts: group.shortcuts.filter(s =>
          s.description.toLowerCase().includes(filter.toLowerCase()) ||
          s.keys.join(' ').toLowerCase().includes(filter.toLowerCase())
        ),
      })).filter(group => group.shortcuts.length > 0)
    : SHORTCUT_GROUPS;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[640px] max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <Keyboard className="w-5 h-5 text-blue-400" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-xs pl-8 pr-3 py-2 rounded-md
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors placeholder-slate-400 dark:placeholder-slate-600"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto eng-scroll px-5 py-3">
          <div className="columns-2 gap-6">
            {filteredGroups.map((group) => (
              <div key={group.title} className="break-inside-avoid mb-4">
                <h3 className="text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-2">{group.title}</h3>
                <div className="space-y-1">
                  {group.shortcuts.map(({ keys, description }) => (
                    <div key={description} className="flex items-center justify-between py-1 group">
                      <span className="text-xs text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-700 dark:text-slate-200 transition-colors">{description}</span>
                      <div className="flex items-center gap-0.5 ml-3">
                        {keys.map((key, i) => (
                          <span key={i}>
                            <kbd className="inline-block min-w-[20px] text-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 
                                          text-[12px] font-mono px-2 py-0.5 rounded shadow-sm shadow-black/20">
                              {key}
                            </kbd>
                            {i < keys.length - 1 && <span className="text-slate-500 dark:text-slate-600 mx-0.5 text-[10px]">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredGroups.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              No shortcuts match "{filter}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 dark:text-slate-600">Press <kbd className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-500 dark:text-slate-400 text-[9px] font-mono">?</kbd> to toggle</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-600">BeamLab PRO</span>
        </div>
      </DialogContent>
    </Dialog>
  );
});
KeyboardShortcutsOverlay.displayName = 'KeyboardShortcutsOverlay';

export default KeyboardShortcutsOverlay;
