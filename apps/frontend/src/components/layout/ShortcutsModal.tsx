/**
 * ShortcutsModal - keyboard shortcuts reference
 */
import { FC } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Table, TableBody, TableCell, TableRow } from '../ui/table';

interface ShortcutItem {
  keys: string;
  action: string;
}

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts?: ShortcutItem[];
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { keys: '⌘ / or Ctrl /', action: 'Open shortcuts' },
  { keys: 'Space + Drag', action: 'Pan view' },
  { keys: 'Scroll / Shift + Scroll', action: 'Zoom / Orbit' },
  { keys: 'S', action: 'Toggle snap' },
  { keys: '?', action: 'Show shortcuts' },
  { keys: 'Cmd + Z / Shift + Cmd + Z', action: 'Undo / Redo' },
  { keys: 'Cmd + S', action: 'Save project' },
];

export const ShortcutsModal: FC<ShortcutsModalProps> = ({ open, onOpenChange, shortcuts }) => {
  const rows = shortcuts?.length ? shortcuts : DEFAULT_SHORTCUTS;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Speed up navigation and editing in the workspace.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.keys}>
                <TableCell className="font-mono text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.keys}</TableCell>
                <TableCell className="text-sm text-slate-700 dark:text-slate-300">{row.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};
