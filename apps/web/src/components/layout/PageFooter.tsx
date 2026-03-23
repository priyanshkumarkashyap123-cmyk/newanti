import React, { FC } from 'react';
import { Link } from 'react-router-dom';

export const PageFooter: FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-canvas)]">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-dim)]">
        <span>© {year} BeamLab. All rights reserved.</span>
        <div className="flex items-center flex-wrap justify-center gap-x-3 gap-y-1">
          <Link to="/help" className="transition-colors hover:text-slate-900 dark:hover:text-[var(--color-text)]">Help</Link>
          <Link to="/support" className="transition-colors hover:text-slate-900 dark:hover:text-[var(--color-text)]">Support</Link>
          <Link to="/contact" className="transition-colors hover:text-slate-900 dark:hover:text-[var(--color-text)]">Contact</Link>
          <Link to="/trust" className="transition-colors hover:text-slate-900 dark:hover:text-[var(--color-text)]">Trust</Link>
          <Link to="/privacy-policy" className="transition-colors hover:text-slate-900 dark:hover:text-[var(--color-text)]">Privacy</Link>
          <Link to="/terms-and-conditions" className="transition-colors hover:text-slate-900 dark:hover:text-[var(--color-text)]">Terms</Link>
        </div>
      </div>
    </footer>
  );
};

export default PageFooter;