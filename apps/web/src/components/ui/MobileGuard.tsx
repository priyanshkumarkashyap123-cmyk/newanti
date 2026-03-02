/**
 * MobileGuard
 *
 * Wraps the 3D modeler and shows a friendly "desktop-only" message
 * when the viewport is too narrow for the engineering interface.
 * On tablet / landscape the modeler still loads; only portrait-phone
 * widths (< 768 px) trigger the guard.
 */

import { FC, ReactNode } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { Monitor, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MobileGuardProps {
  children: ReactNode;
}

export const MobileGuard: FC<MobileGuardProps> = ({ children }) => {
  const { isMobile } = useResponsive();

  if (!isMobile) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-12 text-center">
      <div className="max-w-md space-y-6">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/20 ring-1 ring-blue-500/30">
          <Monitor className="h-10 w-10 text-blue-400" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Desktop Experience Required
        </h1>

        {/* Explanation */}
        <p className="text-slate-400 text-sm leading-relaxed">
          BeamLab&rsquo;s structural modeler uses a full 3D canvas, multi-panel
          layout, and precision interactions that require a larger screen.
          Please open this page on a <strong className="text-slate-200">desktop or laptop</strong> for the
          best experience.
        </p>

        {/* Minimum spec */}
        <div className="rounded-xl bg-slate-800/60 p-4 text-xs text-slate-400 space-y-1">
          <p><span className="text-slate-300 font-medium">Minimum width:</span> 768 px</p>
          <p><span className="text-slate-300 font-medium">Recommended:</span> 1280 × 800 or larger</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Go to Homepage
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/features"
            className="text-sm text-slate-400 underline underline-offset-4 hover:text-slate-200 transition"
          >
            Explore features instead
          </Link>
        </div>
      </div>
    </div>
  );
};
