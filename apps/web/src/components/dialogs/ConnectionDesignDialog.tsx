/**
 * ConnectionDesignDialog.tsx — Steel Connection Design Dialog
 *
 * Wraps the ConnectionDesignPanel into a modal dialog.
 * Provides steel connection design per IS 800:
 * - Simple Shear (Bolt) Connections
 * - Moment (Bolt) Connections
 * - Base Plate Design
 *
 * Triggered by sidebar button: openModal('connectionDesign')
 */

import { FC, lazy, Suspense } from "react";
import { X, Link2, Loader2 } from "lucide-react";

const ConnectionDesignPanel = lazy(() =>
  import("../design/ConnectionDesignPanel").then((m) => ({
    default: m.ConnectionDesignPanel,
  })),
);

interface ConnectionDesignDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionDesignDialog: FC<ConnectionDesignDialogProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-[95vw] max-w-4xl h-[85vh] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-600/10 to-indigo-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Connection Design
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                IS 800 — Shear Bolt, Moment Bolt & Base Plate Connections
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <span className="ml-3 text-slate-500 dark:text-slate-400">
                  Loading connection design...
                </span>
              </div>
            }
          >
            <ConnectionDesignPanel />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ConnectionDesignDialog;
