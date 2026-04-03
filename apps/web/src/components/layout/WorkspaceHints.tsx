/**
 * WorkspaceHints - contextual canvas tips HUD
 * Keeps layout lean while surfacing key interactions.
 */

import type { FC, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface WorkspaceHintItem {
  icon: ReactNode;
  label: string;
  detail: string;
}

interface WorkspaceHintsProps {
  hints: WorkspaceHintItem[];
  onDismiss?: () => void;
  className?: string;
}

export const WorkspaceHints: FC<WorkspaceHintsProps> = ({ hints, onDismiss, className }) => {
  if (!hints?.length) return null;

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col gap-2 max-w-xs text-[var(--color-text)]/80',
        className,
      )}
      aria-label="Workspace tips"
    >
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-surface-strong)]/90 border border-[var(--color-border)] shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-[#adc6ff] shadow-[0_0_0_4px_rgba(173,198,255,0.25)]" />
          Workspace tips
        </div>
        {onDismiss && (
          <button
            type="button"
            className="text-xs text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
            onClick={onDismiss}
            aria-label="Hide workspace tips"
          >
            Hide
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {hints.map((hint) => (
          <div
            key={hint.label}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface)]/80 border border-[var(--color-border)]"
          >
            <span className="text-[#adc6ff] mt-0.5" aria-hidden>
              {hint.icon}
            </span>
            <div className="text-sm leading-tight">
              <p className="font-semibold text-[var(--color-text)]">{hint.label}</p>
              <p className="text-[12px] text-[var(--color-text-soft)]">{hint.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
