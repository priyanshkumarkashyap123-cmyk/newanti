import React, { FC } from 'react';
import { Link } from 'react-router-dom';

export const PageFooter: FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>© {year} BeamLab. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <Link to="/help" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Help</Link>
          <Link to="/privacy-policy" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Privacy</Link>
          <Link to="/terms-and-conditions" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
};

export default PageFooter;