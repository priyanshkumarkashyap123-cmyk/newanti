/**
 * AIArchitectPreview.tsx — Live website preview renderer
 *
 * Features:
 * - Device frame toggle (Desktop, Tablet, Mobile)
 * - Sandboxed HTML preview
 * - Accessibility overlay toggle
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  EyeOff,
  Maximize2,
  Code2,
  Palette,
  Globe,
  Sparkles,
} from 'lucide-react';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface AIArchitectPreviewProps {
  htmlContent: string | null;
  isGenerating: boolean;
}

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const DEVICE_ICONS: Record<DeviceMode, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

export function AIArchitectPreview({ htmlContent, isGenerating }: AIArchitectPreviewProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Build srcDoc with accessibility overlay injection
  const srcDoc = useMemo(() => {
    if (!htmlContent) return null;

    const accessibilityOverlay = showAccessibility
      ? `<style>
  *:focus { outline: 3px solid #7c3aed !important; outline-offset: 2px; }
  img:not([alt]) { border: 3px solid #ef4444 !important; position: relative; }
  img:not([alt])::after { content: "Missing alt text"; background: #ef4444; color: white; padding: 2px 6px; font-size: 10px; position: absolute; top: 0; left: 0; }
  [role]::before { content: attr(role); position: absolute; top: -18px; left: 0; background: #7c3aed; color: white; padding: 1px 4px; font-size: 9px; border-radius: 2px; z-index: 9999; }
  [aria-label]::after { content: "aria: " attr(aria-label); position: absolute; bottom: -18px; left: 0; background: #0ea5e9; color: white; padding: 1px 4px; font-size: 9px; border-radius: 2px; z-index: 9999; }
</style>`
      : '';

    return htmlContent.replace('</head>', `${accessibilityOverlay}</head>`);
  }, [htmlContent, showAccessibility]);

  return (
    <div className="flex flex-col h-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-700/30 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/50 dark:border-slate-700/30 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
        <div className="flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-blue-500 mr-1" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Preview</span>
        </div>

        {/* Device Toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          {(Object.keys(DEVICE_WIDTHS) as DeviceMode[]).map((d) => {
            const Icon = DEVICE_ICONS[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  device === d
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title={d.charAt(0).toUpperCase() + d.slice(1)}
                aria-label={`Switch to ${d} view`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowAccessibility(!showAccessibility)}
            className={`p-1.5 rounded-md transition-all text-xs ${
              showAccessibility
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Toggle accessibility overlay"
            aria-label="Toggle accessibility overlay"
          >
            {showAccessibility ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className={`p-1.5 rounded-md transition-all text-xs ${
              showCode
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Toggle code view"
            aria-label="Toggle code view"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto bg-[repeating-conic-gradient(#f1f5f9_0%_25%,transparent_0%_50%)] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] flex items-start justify-center p-4">
        {isGenerating ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
              </div>
              <div className="absolute -inset-2 rounded-3xl border-2 border-dashed border-blue-300/40 dark:border-blue-600/30 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Generating your website…</p>
              <p className="text-[11px] text-slate-400 mt-1">Crafting layout, styles, and structure</p>
            </div>
          </motion.div>
        ) : !htmlContent ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600">
              <Palette className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">
              Your website preview will appear here
            </p>
            <p className="text-[11px] text-slate-400/70 max-w-[200px]">
              Start by describing what you want to build in the chat panel
            </p>
          </div>
        ) : showCode ? (
          <div className="w-full h-full overflow-auto">
            <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-300 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-700/30 whitespace-pre-wrap break-all leading-relaxed">
              {htmlContent}
            </pre>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={device}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden"
              style={{
                width: DEVICE_WIDTHS[device],
                maxWidth: '100%',
                height: device === 'mobile' ? '667px' : device === 'tablet' ? '580px' : '100%',
                minHeight: device === 'desktop' ? '500px' : undefined,
              }}
            >
              {/* Browser chrome bar */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4 h-5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                  <span className="text-[9px] text-slate-400 font-mono">mywebsite.com</span>
                </div>
              </div>
              <iframe
                srcDoc={srcDoc ?? ''}
                sandbox="allow-scripts"
                className="w-full border-0"
                style={{ height: device === 'mobile' ? '635px' : device === 'tablet' ? '548px' : 'calc(100% - 32px)' }}
                title="Website Preview"
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
