import React, { FC } from 'react';
import { Link } from 'react-router-dom';

export const PageFooter: FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-canvas)]">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-dim)]">
        <span>© {year} BeamLab. All rights reserved.</span>
        <nav className="flex items-center flex-wrap justify-center gap-x-3 gap-y-1" aria-label="Footer links">
          <Link to="/help" className="rounded-sm transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">Help</Link>
          <Link to="/support" className="rounded-sm transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">Support</Link>
          <Link to="/contact" className="rounded-sm transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">Contact</Link>
          <Link to="/trust" className="rounded-sm transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">Trust</Link>
          <Link to="/privacy-policy" className="rounded-sm transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">Privacy</Link>
          <Link to="/terms-and-conditions" className="rounded-sm transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">Terms</Link>
        </nav>
      </div>
    </footer>
  );
};

export default PageFooter;